"""
Users — Endpoints para la gestión de usuarios y roles del CRM.

Este módulo proporciona endpoints para:
1. Listar todos los usuarios registrados (GET /api/users)
2. Cambiar el rol de un usuario (PUT /api/users/{id}/role)

Integración con frontend:
- GET /api/users es consumido por UsersPage.jsx para poblar la tabla
- PUT /api/users/{id}/role es llamado desde el select desplegable de rol
  en cada fila de la tabla de usuarios

Seguridad:
- TODO: Proteger ambos endpoints con autenticación (CurrentUser)
- TODO: Verificar que solo admins puedan acceder a estos endpoints
- TODO: Impedir que un admin se quite su propio rol

Tablas involucradas:
- users: Lectura y actualización de usuarios
- logs: Registro de auditoría de todas las acciones
"""

import logging
from datetime import datetime, timezone

from pydantic import BaseModel, field_validator
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Importación de la sesión de base de datos
from app.database import get_db
# Importación de los modelos de base de datos
from app.models.user import User
from app.models.log import Log

# Logger para registrar eventos en la consola del servidor
logger = logging.getLogger("uvicorn.error")

# Router con prefijo /api y tag para la documentación OpenAPI
router = APIRouter(prefix="/api", tags=["Users"])


# ══════════════════════════════════════════════════════════════════════
# SCHEMAS — Definición de los modelos de entrada/salida
# ══════════════════════════════════════════════════════════════════════

class UserItem(BaseModel):
    """
    Schema de un usuario individual para la respuesta de listado.

    Integración frontend:
    - UsersPage.jsx espera exactamente estos campos para renderizar
      la tabla de usuarios: id, email, role, created_at
    - created_at se serializa como string ISO 8601
    """
    id: int
    email: str
    role: str           # 'admin' | 'gestor'
    created_at: str     # ISO 8601 string

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    """
    Schema de respuesta para GET /api/users.
    Contiene la lista completa de usuarios.

    Integración frontend:
    - UsersPage.jsx accede a response.users para poblar la tabla
    """
    users: list[UserItem]


class RoleUpdateInput(BaseModel):
    """
    Schema de entrada para PUT /api/users/{id}/role.

    Integración frontend:
    - UsersPage.jsx envía { role: "admin" } o { role: "gestor" }
      desde el select desplegable de cada fila de la tabla.

    Validaciones:
    - El campo role es obligatorio
    - Solo acepta valores 'admin' o 'gestor'
    """
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """
        Validador personalizado para el rol.
        - Solo acepta 'admin' o 'gestor'
        - Convierte a minúsculas y elimina espacios
        - Rechaza cualquier otro valor con error descriptivo
        """
        v = v.strip().lower()
        valid_roles = ("admin", "gestor")
        if v not in valid_roles:
            raise ValueError(
                f"Rol inválido: '{v}'. Roles permitidos: {', '.join(valid_roles)}"
            )
        return v


class RoleUpdateResponse(BaseModel):
    """
    Schema de respuesta para PUT /api/users/{id}/role.

    Integración frontend:
    - UsersPage.jsx verifica success === true para mostrar feedback
    - new_role se usa para confirmar el nuevo rol asignado
    """
    success: bool
    new_role: str


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
    - action:   Descripción textual de la acción
    - user_id:  ID del usuario que realizó la acción (NULL si no autenticado)
    - metadata: Datos adicionales en formato dict → JSONB en la DB

    No hace commit — el llamador debe hacer commit de toda la transacción.
    """
    log_entry = Log(
        user_id=user_id,
        action=action,
        metadata_=metadata,
    )
    db.add(log_entry)


def _serialize_user(user: User) -> dict:
    """
    Convierte un objeto User de SQLAlchemy a un diccionario
    compatible con el schema UserItem del frontend.

    Integración frontend:
    - UsersPage.jsx espera { id, email, role, created_at }
    - created_at se convierte a ISO 8601 string para serialización JSON
    """
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else "",
    }


# ══════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════


@router.get(
    "/users",
    response_model=UserListResponse,
    summary="Listar todos los usuarios registrados",
)
async def list_users(
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint: GET /api/users

    Flujo:
    1. Consulta todos los usuarios de la tabla 'users'
    2. Los ordena por fecha de creación descendente (más recientes primero)
    3. Registra la consulta en la tabla 'logs' para auditoría
    4. Serializa y retorna la lista al frontend

    Integración frontend:
    - UsersPage.jsx llama a api.listUsers() al montar el componente
    - La respuesta se usa para renderizar la tabla de usuarios
    - Cada usuario se muestra con su email, rol (select), y fecha

    TODO futuro:
    - Proteger con autenticación: solo admins deberían poder listar usuarios
    - Añadir paginación (limit/offset) para grandes cantidades de usuarios
    - Añadir filtros por rol (GET /api/users?role=admin)
    - Añadir búsqueda por email
    """

    # ── Paso 1: Consultar todos los usuarios ──
    # ORDER BY created_at DESC para mostrar los más recientes primero
    # Esto coincide con lo que el frontend espera visualmente
    result = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    # scalars() extrae los objetos ORM de los resultados
    # .all() los convierte en una lista Python
    all_users = result.scalars().all()

    logger.info(f"[users] Consulta de usuarios — {len(all_users)} encontrados")

    # ── Paso 2: Registrar la acción en logs ──
    # Se registra quién consultó (por ahora NULL) y cuántos usuarios había
    # El endpoint se incluye en metadata para trazabilidad
    await _create_log(
        db=db,
        action="Consultó lista de usuarios",
        user_id=None,  # TODO: usar CurrentUser.id cuando se integre auth
        metadata={
            "endpoint": "/api/users",
            "total_users": len(all_users),
        },
    )
    await db.commit()

    # ── Paso 3: Serializar y retornar ──
    # Convertimos cada objeto User a un dict compatible con el schema
    # que espera UsersPage.jsx
    return {
        "users": [_serialize_user(u) for u in all_users]
    }


@router.put(
    "/users/{user_id}/role",
    response_model=RoleUpdateResponse,
    summary="Cambiar el rol de un usuario",
)
async def update_user_role(
    user_id: int,
    data: RoleUpdateInput,
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint: PUT /api/users/{id}/role

    Flujo completo de cambio de rol:
    1. Recibe el nuevo rol desde el body { "role": "admin"|"gestor" }
    2. Valida que el rol sea válido (el schema RoleUpdateInput lo hace)
    3. Busca el usuario por ID en la tabla 'users'
    4. Verifica que el usuario exista (404 si no)
    5. Actualiza el campo role del usuario
    6. Registra la acción en logs con metadata del cambio
    7. Commit atómico

    Integración frontend:
    - UsersPage.jsx llama a api.updateUserRole(userId, newRole)
      cuando el usuario cambia el select desplegable de rol
    - Si success === true, el frontend muestra un mensaje de éxito
    - Si hay error, el frontend muestra el mensaje de error

    Errores posibles:
    - 400 (422): Rol inválido (validación de Pydantic)
    - 404: Usuario no encontrado
    - 403: No autorizado (cuando se implemente validación real)

    Seguridad:
    - TODO: Solo admins deberían poder cambiar roles de otros usuarios
    - TODO: Impedir que un admin se quite su propio rol si es el último admin
    - TODO: Registrar el ID del admin que realiza el cambio en reviewed_by
    - TODO: Enviar notificación al usuario cuyo rol cambió
    """

    # ── Paso 1: Buscar el usuario en la base de datos ──
    # Buscamos por ID primario
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    # ── Paso 2: Verificar que el usuario existe ──
    # Si no se encuentra, devolvemos 404 con mensaje descriptivo
    if not user:
        logger.warning(f"[users/role] Usuario ID {user_id} no encontrado")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con ID {user_id} no encontrado",
        )

    # ── Paso 3: Verificar que el rol es diferente al actual ──
    # Si el rol es el mismo, no hacemos nada pero retornamos éxito
    # Esto evita escrituras innecesarias en la DB
    old_role = user.role
    if old_role == data.role:
        logger.info(
            f"[users/role] Usuario ID {user_id} ya tiene rol '{data.role}', "
            "sin cambios necesarios"
        )
        return {"success": True, "new_role": data.role}

    # ── Paso 4: Validación de seguridad (preparado para futuro) ──
    # TODO: Cuando se integre autenticación, descomentar esta lógica:
    #
    # current_user = get_current_user(request)
    # if current_user.role != 'admin':
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Solo los administradores pueden cambiar roles"
    #     )
    #
    # TODO: Impedir que el último admin se quite su rol:
    # if user.id == current_user.id and data.role != 'admin':
    #     admin_count = await db.execute(
    #         select(func.count()).where(User.role == 'admin')
    #     )
    #     if admin_count.scalar() <= 1:
    #         raise HTTPException(
    #             status_code=status.HTTP_400_BAD_REQUEST,
    #             detail="No puedes quitarte el rol de admin si eres el último"
    #         )

    # ── Paso 5: Actualizar el rol del usuario ──
    # Cambiamos el campo role del objeto ORM — SQLAlchemy detecta el cambio
    user.role = data.role

    logger.info(
        f"[users/role] Usuario ID {user_id} ({user.email}): "
        f"rol cambiado de '{old_role}' a '{data.role}'"
    )

    # ── Paso 6: Registrar la acción en logs ──
    # Incluimos en metadata toda la información relevante del cambio
    await _create_log(
        db=db,
        action="Cambio de rol de usuario",
        user_id=None,  # TODO: usar CurrentUser.id cuando se integre auth
        metadata={
            "user_changed": user_id,
            "email": user.email,
            "old_role": old_role,
            "new_role": data.role,
        },
    )

    # ── Paso 7: Commit atómico ──
    # Se guardan juntos: actualización de usuario + log
    # Si cualquier operación falla, se revierte todo
    await db.commit()

    # ── Paso 8: Respuesta al frontend ──
    # UsersPage.jsx verifica success === true para mostrar feedback de éxito
    return {"success": True, "new_role": data.role}
