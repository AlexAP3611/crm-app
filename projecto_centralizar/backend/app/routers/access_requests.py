"""
Access Requests — Endpoints para el flujo de solicitud de acceso de usuarios.

Este módulo gestiona todo el ciclo de vida de las solicitudes de acceso:
1. Un usuario externo envía una solicitud (POST /api/request-access)
2. Un administrador consulta las solicitudes pendientes (GET /api/requests)
3. Un administrador aprueba (POST /api/requests/{id}/approve) o
   rechaza (POST /api/requests/{id}/reject) la solicitud

Todas las operaciones se persisten en la base de datos PostgreSQL:
- Tabla 'user_requests': almacena las solicitudes con su estado
- Tabla 'users': se crea un usuario real cuando una solicitud es aprobada
- Tabla 'logs': registra cada acción para auditoría

Seguridad:
- Las contraseñas se hashean con bcrypt antes de almacenar
- Se valida que el email no esté vacío y tenga formato correcto (EmailStr)
- Se valida que la contraseña tenga al menos 6 caracteres
- Se comprueba duplicidad de email antes de crear usuario

TODO futuro:
- Proteger GET /requests y POST approve/reject con autenticación (CurrentUser)
- Añadir paginación a GET /requests
- Enviar emails de notificación al aprobar/rechazar
- Implementar rate limiting en POST /request-access
"""

import logging
from datetime import datetime, timezone

from pydantic import BaseModel, EmailStr, field_validator
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Importación del hash de contraseñas y autorización desde el módulo de autenticación
# - get_password_hash: para hashear contraseñas de nuevos solicitantes
# - AdminUser: dependencia que requiere rol admin (require_admin -> 403 si no es admin)
from app.auth import get_password_hash, AdminUser
# Importación de la sesión de base de datos
from app.database import get_db
# Importación de los modelos de base de datos
from app.models.user_request import UserRequest
from app.models.user import User
from app.models.log import Log

# Logger para registrar eventos en la consola del servidor
logger = logging.getLogger("uvicorn.error")

# Router con prefijo /api y tag para la documentación OpenAPI
router = APIRouter(prefix="/api", tags=["Access Requests"])


# ══════════════════════════════════════════════════════════════════════
# SCHEMAS — Definición de los modelos de entrada/salida para los endpoints
# ══════════════════════════════════════════════════════════════════════

class RequestAccessInput(BaseModel):
    """
    Schema de entrada para POST /api/request-access.

    Valida que:
    - email tenga formato válido (EmailStr de Pydantic lo verifica)
    - password no esté vacía y tenga al menos 6 caracteres

    Estos datos son los que el usuario proporciona en el formulario
    de solicitud de acceso (RequestAccessPage.jsx).
    """
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_not_empty(cls, v: str) -> str:
        """
        Validador personalizado para la contraseña.
        - Rechaza contraseñas vacías o solo espacios
        - Exige un mínimo de 6 caracteres
        - Elimina espacios al inicio y final (strip)
        """
        if not v or not v.strip():
            raise ValueError("La contraseña no puede estar vacía")
        if len(v.strip()) < 6:
            raise ValueError("La contraseña debe tener al menos 6 caracteres")
        return v.strip()


class RequestAccessResponse(BaseModel):
    """Schema de respuesta para POST /api/request-access."""
    message: str


class AccessRequestItem(BaseModel):
    """
    Schema de un elemento individual de solicitud.
    Se usa dentro de AccessRequestListResponse para listar solicitudes.

    NOTA: El frontend (RequestsPage.jsx) espera el campo 'requested_at'
    (no 'created_at'), por lo que mapeamos created_at -> requested_at
    en la función de serialización.
    """
    id: int
    email: str
    requested_at: str   # ISO 8601 string — mapeado desde created_at del modelo
    status: str         # 'pending' | 'approved' | 'rejected'


class AccessRequestListResponse(BaseModel):
    """Schema de respuesta para GET /api/requests — lista de solicitudes paginada."""
    items: list[AccessRequestItem]
    total: int
    page: int
    page_size: int


class ActionResponse(BaseModel):
    """Schema de respuesta para approve/reject — éxito o fallo."""
    success: bool


# ══════════════════════════════════════════════════════════════════════
# FUNCIONES AUXILIARES
# ══════════════════════════════════════════════════════════════════════

async def _create_log(
    db: AsyncSession,
    action: str,
    user_id: int | None = None,
    metadata: dict | None = None,
) -> None:
    """
    Registra una acción en la tabla de logs para auditoría.

    Parámetros:
    - db:       Sesión de base de datos activa
    - action:   Descripción textual de la acción (ej: "Nueva solicitud de usuario")
    - user_id:  ID del usuario que realizó la acción (NULL si anónimo)
    - metadata: Datos adicionales en formato dict → JSONB en la DB

    Esta función no hace commit — se espera que el llamador haga
    commit/flush de toda la transacción junta para mantener atomicidad.
    """
    log_entry = Log(
        user_id=user_id,
        action=action,
        metadata_=metadata,  # metadata_ es el atributo Python, se mapea a columna "metadata"
    )
    db.add(log_entry)


def _serialize_request(req: UserRequest) -> dict:
    """
    Convierte un objeto UserRequest de SQLAlchemy a un diccionario
    compatible con el schema AccessRequestItem del frontend.

    Mapea 'created_at' del modelo a 'requested_at' que espera el frontend.
    Convierte el datetime a string ISO 8601 para serialización JSON.
    """
    return {
        "id": req.id,
        "email": req.email,
        # El frontend espera 'requested_at', pero en la DB es 'created_at'
        "requested_at": req.created_at.isoformat() if req.created_at else "",
        "status": req.status,
    }


# ══════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════


@router.post(
    "/request-access",
    response_model=RequestAccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enviar una nueva solicitud de acceso",
)
async def request_access(
    data: RequestAccessInput,
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint: POST /api/request-access

    Flujo:
    1. Recibe email y contraseña del formulario de solicitud
    2. Hashea la contraseña con bcrypt (nunca se almacena en texto plano)
    3. Crea un registro en 'user_requests' con estado 'pending'
    4. Registra la acción en la tabla 'logs' para auditoría
    5. Retorna mensaje de confirmación al frontend

    Seguridad:
    - La contraseña se hashea antes de almacenar (bcrypt via passlib)
    - EmailStr valida el formato del email automáticamente
    - El validador password_not_empty asegura mínimo 6 caracteres

    Errores posibles:
    - 422: Datos inválidos (email mal formado, contraseña corta)
    - 500: Error de base de datos (conexión, constraint violation)
    """

    # ── Paso 1: Hashear la contraseña con bcrypt ──
    # SEGURIDAD: Nunca almacenamos contraseñas en texto plano.
    # Se usa el mismo get_password_hash() de app.auth que ya usa el CRM
    # para mantener consistencia en el algoritmo de hashing.
    hashed_password = get_password_hash(data.password)
    logger.info(f"[request-access] Nueva solicitud recibida para: {data.email}")

    # ── Paso 2: Crear el registro en la tabla user_requests ──
    # El estado inicial es 'pending' (definido como server_default en el modelo)
    # reviewed_by y reviewed_at quedan NULL hasta que un admin actúe
    new_request = UserRequest(
        email=data.email,
        password=hashed_password,  # Hash, no texto plano
    )
    db.add(new_request)

    # ── Paso 3: Registrar la acción en la tabla de logs ──
    # user_id es NULL porque el solicitante no tiene cuenta aún
    # metadata incluye el email para trazabilidad
    await _create_log(
        db=db,
        action="Nueva solicitud de usuario",
        user_id=None,  # El solicitante no es un usuario registrado aún
        metadata={"email": data.email},
    )

    # ── Paso 4: Commit de la transacción ──
    # Se hace commit de todo junto (solicitud + log) para mantener
    # atomicidad — o ambos se guardan, o ninguno
    await db.commit()
    logger.info(f"[request-access] Solicitud guardada en DB para: {data.email}")

    # ── Paso 5: Respuesta al frontend ──
    return {"message": "Solicitud enviada. Pendiente de aprobación."}


@router.get(
    "/requests",
    response_model=AccessRequestListResponse,
    summary="Listar todas las solicitudes de acceso",
)
async def list_requests(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    status: str | None = None,
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(50, ge=1, le=200, description="Tamaño de página"),
):
    """
    Endpoint: GET /api/requests

    Parámetros de query opcionales:
    - status: Filtro por estado de la solicitud.
        * "pending" → solo solicitudes pendientes
        * "all" o sin param → todas las solicitudes (pending, approved, rejected)

    Este filtro es útil para eficiencia futura del backend (evitar enviar
    datos innecesarios al frontend). Actualmente, el frontend también
    filtra localmente con un toggle visible al usuario.

    Flujo:
    1. Construye la query base (con o sin filtro de status)
    2. Ordena por fecha de creación descendente (más recientes primero)
    3. Registra la consulta en la tabla 'logs'
    4. Serializa y retorna la lista al frontend

    El frontend (RequestsPage.jsx) renderiza esta lista en una tabla
    con acciones de aprobar/rechazar para solicitudes pendientes.
    """

    # ── Paso 1: Construir query con filtro opcional ──
    query = select(UserRequest)
    if status == "pending":
        query = query.where(UserRequest.status == "pending")

    # ── Paso 2: Contar total de registros ──
    count_stmt = select(func.count(UserRequest.id))
    if status == "pending":
        count_stmt = count_stmt.where(UserRequest.status == "pending")
    
    total = await db.scalar(count_stmt) or 0

    # ── Paso 3: Aplicar orden estable y paginación ──
    offset = (page - 1) * page_size
    query = query.order_by(UserRequest.created_at.desc(), UserRequest.id.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    all_requests = result.scalars().all()

    logger.info(
        f"[requests] Consulta de solicitudes "
        f"(filtro={status or 'all'}, page={page}, page_size={page_size}) — {len(all_requests)} encontradas"
    )

    # ── Paso 4: Registrar la acción en logs ──
    await _create_log(
        db=db,
        action="Consultó solicitudes de usuario",
        user_id=admin.id,
        metadata={
            "total_requests": len(all_requests),
            "admin_email": admin.email,
            "status_filter": status or "all",
            "page": page,
            "page_size": page_size
        },
    )
    await db.commit()

    # ── Paso 5: Serializar y retornar ──
    return {
        "items": [_serialize_request(req) for req in all_requests],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post(
    "/requests/{request_id}/approve",
    response_model=ActionResponse,
    summary="Aprobar una solicitud de acceso",
)
async def approve_request(
    request_id: int,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint: POST /api/requests/{id}/approve

    Flujo completo de aprobación:
    1. Busca la solicitud por ID en la tabla 'user_requests'
    2. Verifica que la solicitud exista (404 si no)
    3. Verifica que la solicitud esté en estado 'pending' (400 si no)
    4. Verifica que el email no exista ya en la tabla 'users' (409 si ya existe)
    5. Crea un nuevo usuario en la tabla 'users' con rol 'gestor'
    6. Actualiza la solicitud a estado 'approved' con timestamps
    7. Registra la acción en logs
    8. Commit atómico de todo

    Errores posibles:
    - 404: Solicitud no encontrada
    - 400: Solicitud ya fue procesada (no está en 'pending')
    - 409: Ya existe un usuario con ese email
    - 500: Error de base de datos

    Seguridad:
    - El password_hash se copia directamente de la solicitud al usuario
      (ya fue hasheado en el momento de la solicitud)
    - El rol se establece como 'gestor' por defecto
    - reviewed_by queda NULL hasta integrar autenticación de admin

    TODO futuro:
    - Recibir CurrentUser y guardar su ID en reviewed_by
    - Enviar email de bienvenida al usuario aprobado
    - Permitir seleccionar el rol al aprobar
    """

    # ── Paso 1: Buscar la solicitud en la base de datos ──
    result = await db.execute(
        select(UserRequest).where(UserRequest.id == request_id)
    )
    request_obj = result.scalar_one_or_none()

    # ── Paso 2: Verificar que la solicitud existe ──
    if not request_obj:
        logger.warning(f"[approve] Solicitud ID {request_id} no encontrada")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Solicitud {request_id} no encontrada",
        )

    # ── Paso 3: Verificar que la solicitud esté pendiente ──
    # Solo se pueden aprobar solicitudes en estado 'pending'
    # Si ya fue aprobada o rechazada, retornamos error 400
    if request_obj.status != "pending":
        logger.warning(
            f"[approve] Solicitud ID {request_id} ya fue procesada "
            f"(estado actual: {request_obj.status})"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La solicitud ya fue procesada (estado: {request_obj.status})",
        )

    # ── Paso 4: Buscar si existe un usuario con ese email (activo o inactivo) ──
    # La columna 'email' tiene UNIQUE constraint en la DB, por lo que no podemos
    # hacer INSERT de un nuevo usuario con el mismo email aunque esté inactivo.
    # Solución: si existe un usuario inactivo (borrado lógico), lo reactivamos.
    # Si existe uno activo, bloqueamos con 409.
    existing_result = await db.execute(
        select(User).where(User.email == request_obj.email)
    )
    existing_user = existing_result.scalar_one_or_none()

    if existing_user is not None:
        if existing_user.is_active:
            # Usuario activo con ese email → conflicto real
            logger.warning(
                f"[approve] Email {request_obj.email} ya existe como usuario activo"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un usuario activo con el email {request_obj.email}",
            )
        else:
            # Usuario eliminado (soft delete) → reactivar en lugar de insertar nuevo
            # Esto evita violar el UNIQUE constraint de la columna email
            logger.info(
                f"[approve] Reactivando usuario eliminado: {request_obj.email}"
            )
            existing_user.is_active = True
            existing_user.password_hash = request_obj.password  # Actualiza contraseña
            existing_user.role = "gestor"  # Resetea rol al aprobar de nuevo
    else:
        # ── Paso 5: Crear el nuevo usuario en la tabla 'users' ──
        # El password_hash se copia directamente de la solicitud
        # (ya fue hasheado con bcrypt al enviar la solicitud)
        # El rol por defecto es 'gestor' (definido en el modelo User)
        existing_user = User(
            email=request_obj.email,
            password_hash=request_obj.password,  # Ya es un hash bcrypt
            # role="gestor" — ya es el server_default del modelo
        )
        db.add(existing_user)

    # ── Paso 6: Actualizar la solicitud a 'approved' ──
    # Marcamos la solicitud como aprobada y registramos cuándo y por quién
    request_obj.status = "approved"
    # reviewed_by registra qué admin aprobó la solicitud (para auditoría)
    request_obj.reviewed_by = admin.id
    # Registramos el momento exacto de la aprobación (UTC)
    request_obj.reviewed_at = datetime.now(timezone.utc)

    logger.info(
        f"[approve] Solicitud ID {request_id} aprobada por admin {admin.email} — "
        f"usuario creado: {request_obj.email}"
    )

    # ── Paso 7: Registrar la acción en logs ──
    # TODO: considerar añadir logs de acceso más detallados si se desea auditar
    await _create_log(
        db=db,
        action="Solicitud aprobada",
        user_id=admin.id,  # ID del admin que aprobó la solicitud
        metadata={
            "request_id": request_id,
            "email": request_obj.email,
            "approved_by": admin.email,
            "new_user_role": "gestor",
        },
    )

    # ── Paso 8: Commit atómico ──
    # Se guardan juntos: nuevo usuario + actualización de solicitud + log
    # Si cualquier INSERT/UPDATE falla, se revierte todo (rollback automático)
    await db.commit()

    return {"success": True}


@router.post(
    "/requests/{request_id}/reject",
    response_model=ActionResponse,
    summary="Rechazar una solicitud de acceso",
)
async def reject_request(
    request_id: int,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint: POST /api/requests/{id}/reject

    Flujo de rechazo:
    1. Busca la solicitud por ID
    2. Verifica que exista (404 si no)
    3. Verifica que esté en estado 'pending' (400 si no)
    4. Actualiza la solicitud a estado 'rejected' con timestamps
    5. Registra la acción en logs
    6. Commit atómico

    A diferencia de approve, aquí NO se crea un usuario — solo se
    actualiza el estado de la solicitud.

    Errores posibles:
    - 404: Solicitud no encontrada
    - 400: Solicitud ya fue procesada
    - 500: Error de base de datos

    TODO futuro:
    - Recibir CurrentUser y guardar su ID en reviewed_by
    - Enviar email de notificación al solicitante rechazado
    - Permitir añadir un motivo de rechazo
    """

    # ── Paso 1: Buscar la solicitud en la base de datos ──
    result = await db.execute(
        select(UserRequest).where(UserRequest.id == request_id)
    )
    request_obj = result.scalar_one_or_none()

    # ── Paso 2: Verificar que la solicitud existe ──
    if not request_obj:
        logger.warning(f"[reject] Solicitud ID {request_id} no encontrada")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Solicitud {request_id} no encontrada",
        )

    # ── Paso 3: Verificar que la solicitud esté pendiente ──
    # Solo se pueden rechazar solicitudes en estado 'pending'
    if request_obj.status != "pending":
        logger.warning(
            f"[reject] Solicitud ID {request_id} ya fue procesada "
            f"(estado actual: {request_obj.status})"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La solicitud ya fue procesada (estado: {request_obj.status})",
        )

    # ── Paso 4: Actualizar la solicitud a 'rejected' ──
    request_obj.status = "rejected"
    # reviewed_by registra qué admin rechazó la solicitud (para auditoría)
    request_obj.reviewed_by = admin.id
    # Registramos el momento exacto del rechazo (UTC)
    request_obj.reviewed_at = datetime.now(timezone.utc)

    logger.info(f"[reject] Solicitud ID {request_id} rechazada por admin {admin.email}")

    # ── Paso 5: Registrar la acción en logs ──
    # TODO: considerar añadir logs de acceso más detallados si se desea auditar
    await _create_log(
        db=db,
        action="Solicitud rechazada",
        user_id=admin.id,  # ID del admin que rechazó la solicitud
        metadata={
            "request_id": request_id,
            "email": request_obj.email,
            "rejected_by": admin.email,
        },
    )

    # ── Paso 6: Commit atómico ──
    # Se guardan juntos: actualización de solicitud + log
    await db.commit()

    return {"success": True}
