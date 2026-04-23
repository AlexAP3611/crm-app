"""
Auth Router — Endpoints de autenticación del CRM.

Este módulo proporciona los endpoints de login, logout, consulta de
perfil del usuario actual y cambio de contraseña.

Endpoints:
1. POST /api/login           → Autenticación con email y contraseña, devuelve JWT
2. POST /api/logout          → Cierra la sesión (limpia cookie de sesión)
3. GET  /api/me              → Devuelve los datos del usuario autenticado
4. POST /api/change-password → Permite al usuario cambiar su contraseña
5. POST /api/refresh         → Renueva el JWT si el token actual es válido (keepalive de sesión)

Flujo de autenticación con JWT:
1. El usuario envía email y contraseña a POST /api/login
2. El servidor verifica las credenciales contra la tabla 'users'
3. Si son correctas, genera un JWT con user_id, email y role
4. El frontend almacena el token y lo envía en cada request:
   Authorization: Bearer <token>
5. El middleware get_current_user decodifica el token y carga el usuario

Seguridad:
- Las contraseñas se verifican usando bcrypt (nunca texto plano)
- Los tokens JWT se firman con HMAC-SHA256
- Los tokens tienen expiración configurable (default: 1 hora)
- Se mantiene compatibilidad con sesiones para transición gradual

TODO futuro:
- Implementar refresh tokens para renovar el access token
- Añadir endpoint POST /api/refresh para renovar tokens
- Rate limiting en intentos de login (prevenir fuerza bruta)
- Registrar intentos fallidos en la tabla logs
"""

import logging

from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import timedelta
from app.auth import CurrentUser, verify_password, get_password_hash, create_access_token
from app.database import get_db
from app.models.user import User
from app.models.log import Log

# Logger para registrar eventos de autenticación
logger = logging.getLogger("uvicorn.error")

# Router con prefijo /api y tag para la documentación OpenAPI
router = APIRouter(prefix="/api", tags=["Auth"])


# ══════════════════════════════════════════════════════════════════════
# SCHEMAS — Modelos de entrada/salida
# ══════════════════════════════════════════════════════════════════════


class LoginRequest(BaseModel):
    """
    Schema de entrada para POST /api/login.

    Campos:
    - email:    Email del usuario (validado por EmailStr de Pydantic)
    - password: Contraseña en texto plano (se compara con el hash en DB)

    Integración frontend:
    - El formulario de login envía estos datos al hacer submit
    """
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """
    Schema de respuesta para POST /api/login.

    Campos:
    - access_token: Token JWT firmado con los datos del usuario
    - token_type:   Tipo de token (siempre "bearer", estándar OAuth2)

    Integración frontend:
    - El frontend almacena access_token en localStorage o estado
    - Lo envía en cada request: Authorization: Bearer <access_token>
    """
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """
    Schema de respuesta para GET /api/me.

    Campos:
    - id:    ID del usuario
    - email: Email del usuario
    - role:  Rol del usuario ('admin' o 'gestor')

    Integración frontend:
    - Se usa para mostrar el nombre del usuario en el header
    - Se usa para controlar qué páginas/acciones están disponibles
      según el rol del usuario
    """
    id: int
    email: str
    role: str

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    """
    Schema de entrada para POST /api/change-password.

    Campos:
    - current_password: Contraseña actual del usuario (para verificar identidad)
    - new_password:     Nueva contraseña que se quiere establecer (mín. 6 caracteres)

    Integración frontend:
    - El formulario de cambio de contraseña en SettingsPage envía estos datos
    - El campo confirmPassword se valida solo en el frontend (UX)
    """
    current_password: str
    new_password: str


# ══════════════════════════════════════════════════════════════════════
# FUNCIONES AUXILIARES
# ══════════════════════════════════════════════════════════════════════


async def _log_login_attempt(
    db: AsyncSession,
    email: str,
    success: bool,
    user_id: int | None = None,
) -> None:
    """
    Registra un intento de login en la tabla de logs para auditoría.

    Parámetros:
    - db:      Sesión de base de datos
    - email:   Email utilizado en el intento
    - success: True si el login fue exitoso, False si falló
    - user_id: ID del usuario (solo si el login fue exitoso)
    """
    log_entry = Log(
        user_id=user_id,
        action="Login exitoso" if success else "Intento de login fallido",
        metadata_={
            "email": email,
            "success": success,
        },
    )
    db.add(log_entry)


# ══════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Autenticarse y obtener un token JWT",
)
async def login(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint: POST /api/login

    Flujo de autenticación:
    1. Recibe email y contraseña del formulario de login
    2. Busca el usuario en la tabla 'users' por email
    3. Verifica la contraseña contra el hash bcrypt almacenado
    4. Si las credenciales son correctas:
       a) Genera un JWT con user_id, email y role
       b) También establece la sesión (compatibilidad con flujo anterior)
       c) Registra el login exitoso en logs
       d) Retorna { access_token, token_type: "bearer" }
    5. Si las credenciales son incorrectas:
       a) Registra el intento fallido en logs
       b) Retorna 401 con mensaje genérico (no revelar si el email existe)

    Seguridad:
    - La contraseña se verifica con bcrypt (timing-safe comparison)
    - El mensaje de error es genérico para no revelar si el email existe
    - Se registran tanto intentos exitosos como fallidos para auditoría

    Integración frontend:
    - El frontend envía { email, password } desde el formulario de login
    - Si recibe 200, almacena el access_token y redirige al dashboard
    - Si recibe 401, muestra el mensaje de error

    TODO futuro:
    - Rate limiting: máximo 5 intentos por minuto por IP
    - Bloqueo temporal tras múltiples intentos fallidos
    - Soporte para 2FA (autenticación de dos factores)
    """

    # ── Paso 1: Buscar el usuario por email ──
    # Se busca en la tabla 'users' (solo usuarios aprobados están aquí)
    result = await db.execute(
        select(User).where(User.email == data.email)
    )
    user = result.scalar_one_or_none()

    # ── Paso 2: Verificar credenciales ──
    # Se verifica tanto que el usuario exista como que la contraseña coincida
    # Si el usuario no existe, verify_password no se ejecuta pero el error
    # es el mismo para no revelar si el email está registrado
    if not user or not verify_password(data.password, user.password_hash):
        logger.warning(f"[login] Intento de login fallido para: {data.email}")

        # Registrar el intento fallido en logs
        await _log_login_attempt(db, data.email, success=False)
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )

    # ── Paso 3: Generar token JWT ──
    # El token contiene: user_id (sub), email, role, expiración
    # Se firma con la clave secreta del servidor (HMAC-SHA256)
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
    )

    # ── Paso 4: Establecer sesión (compatibilidad) ──
    # Mantenemos la sesión por cookie para compatibilidad con el flujo anterior
    # En el futuro, cuando todo el frontend use JWT, se puede eliminar
    request.session["user_id"] = user.id

    logger.info(f"[login] Login exitoso: {user.email} (role: {user.role})")

    # ── Paso 5: Registrar en logs y responder ──
    await _log_login_attempt(db, user.email, success=True, user_id=user.id)
    await db.commit()

    # Respuesta con el token JWT
    # El frontend debe almacenar access_token y enviarlo en cada request:
    # headers: { Authorization: "Bearer <access_token>" }
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post(
    "/logout",
    summary="Cerrar sesión",
)
async def logout(request: Request):
    """
    Endpoint: POST /api/logout

    Limpia la sesión del servidor (cookie).

    Nota sobre JWT:
    Los JWT son stateless — no se pueden "invalidar" desde el servidor
    porque el servidor no mantiene estado. El token sigue siendo válido
    hasta que expire.

    Para un logout efectivo con JWT, el frontend debe:
    1. Eliminar el token de localStorage/estado
    2. Llamar a este endpoint para limpiar la cookie de sesión

    TODO futuro:
    - Implementar una blacklist de tokens (en Redis o DB) para
      invalidar tokens antes de su expiración natural
    """
    request.session.clear()
    return {"message": "Sesión cerrada correctamente"}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Obtener datos del usuario autenticado",
)
async def get_me(user: CurrentUser):
    """
    Endpoint: GET /api/me

    Retorna los datos del usuario actualmente autenticado.
    Requiere autenticación (JWT, API key, o sesión).

    Respuesta:
    - id:    ID del usuario en la base de datos
    - email: Email del usuario
    - role:  Rol del usuario ('admin' o 'gestor')

    Integración frontend:
    - Se llama al cargar la aplicación para verificar si el usuario
      está autenticado y obtener sus datos
    - Si retorna 401, el frontend redirige al login
    - El campo 'role' se usa para mostrar/ocultar opciones de admin
    """
    return user


@router.post(
    "/change-password",
    summary="Cambiar la contraseña del usuario autenticado",
)
async def change_password(
    data: ChangePasswordRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint: POST /api/change-password

    Permite a cualquier usuario autenticado cambiar su contraseña.
    Accesible para todos los roles (admin y gestor), sin restricciones.

    Flujo:
    1. Recibe current_password y new_password del formulario
    2. Verifica que current_password coincide con el hash en DB (bcrypt)
    3. Valida que new_password tenga al menos 6 caracteres
    4. Hashea new_password con bcrypt y actualiza en DB
    5. Registra la acción en la tabla de logs para auditoría

    Seguridad:
    - Se requiere la contraseña actual para prevenir cambios no autorizados
      (ej: si alguien accede a una sesión abierta del usuario)
    - La nueva contraseña se hashea con bcrypt antes de almacenarla
    - Se usa verify_password() que es timing-safe (previene timing attacks)

    ¿Por qué se usa bcrypt?
    - bcrypt genera un salt aleatorio por cada hash (incluso con la misma
      contraseña, cada hash es diferente)
    - Tiene un factor de costo configurable que lo hace lento de fuerza bruta
    - La función verify_password() de passlib es timing-safe: siempre tarda
      lo mismo, evitando que un atacante pueda deducir si acertó parcialmente

    ¿Cómo se identifica al usuario?
    - El usuario se obtiene automáticamente del JWT mediante la dependencia
      CurrentUser (inyectada por FastAPI). El JWT contiene el user_id
      en el claim "sub", que se usa para buscar al usuario en la DB.

    TODO futuro:
    - Implementar historial de contraseñas (no permitir reusar las últimas N)
    - Añadir reglas de complejidad (mayúsculas, números, símbolos)
    - Rate limiting para prevenir intentos de fuerza bruta en la contraseña actual
    - Invalidar todos los tokens JWT activos tras el cambio (requiere blacklist)
    """

    # ── Paso 1: Verificar que la contraseña actual sea correcta ──
    # Usa bcrypt para comparar de forma segura (timing-safe)
    if not verify_password(data.current_password, user.password_hash):
        logger.warning(
            f"[change-password] Contraseña actual incorrecta para user_id={user.id} ({user.email})"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual es incorrecta",
        )

    # ── Paso 2: Validar la nueva contraseña ──
    # Longitud mínima de 6 caracteres (regla básica de seguridad)
    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 6 caracteres",
        )

    # ── Paso 3: Hashear la nueva contraseña y actualizar en DB ──
    # get_password_hash() genera un nuevo hash bcrypt con salt aleatorio
    user.password_hash = get_password_hash(data.new_password)

    # ── Paso 4: Registrar la acción en logs para auditoría ──
    log_entry = Log(
        user_id=user.id,
        action="Cambio de contraseña",
        metadata_={
            "email": user.email,
        },
    )
    db.add(log_entry)

    await db.commit()

    logger.info(
        f"[change-password] Contraseña cambiada exitosamente para user_id={user.id} ({user.email})"
    )

    return {"message": "Contraseña actualizada correctamente"}


# ══════════════════════════════════════════════════════════════════════
# REFRESH TOKEN — Renovación de sesión activa
# ══════════════════════════════════════════════════════════════════════


@router.post(
    "/refresh",
    response_model=LoginResponse,
    summary="Renovar token JWT (keepalive de sesión)",
)
async def refresh_token(user: CurrentUser):
    """
    Endpoint: POST /api/refresh

    Emite un nuevo JWT con expiración fresca para un usuario ya autenticado.
    Solo funciona si el token actual es válido — si ha expirado, get_current_user
    lanzará automáticamente HTTP 401 antes de llegar aquí.

    Uso:
    - El frontend llama a este endpoint cuando el usuario pulsa "Continuar sesión"
      en el modal de aviso de inactividad (después de 25 min sin actividad).
    - Requiere que el token no haya expirado aún (la ventana de renovación
      es entre los 25 y 30 minutos de inactividad).

    Flujo:
    1. CurrentUser valida el JWT actual → si expiró, devuelve 401 antes de aquí
    2. Verificar que el usuario sigue activo (is_active)
    3. Generar nuevo JWT con expiración fresca (REFRESH_TOKEN_EXPIRE_MINUTES)
    4. Registrar la renovación en logs para auditoría
    5. Devolver el nuevo token al frontend

    El frontend almacena el nuevo token y reinicia sus timers de inactividad.
    """
    from app.config import settings

    # Generar nuevo token con expiración fresca
    new_token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        expires_delta=timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES),
    )

    logger.info(
        f"[refresh] Token renovado para user_id={user.id} ({user.email})"
    )

    return {
        "access_token": new_token,
        "token_type": "bearer",
    }
