"""
Auth — Módulo de autenticación y autorización del CRM.

Este módulo centraliza toda la lógica de seguridad:

1. Hashing de contraseñas (bcrypt via passlib)
   - verify_password(): Compara una contraseña en texto plano con su hash
   - get_password_hash(): Genera un hash bcrypt de una contraseña

2. Tokens JWT (JSON Web Tokens)
   - create_access_token(): Genera un token firmado con user_id, email, role
   - _decode_jwt(): Verifica y decodifica un token JWT

3. Autenticación de usuarios (get_current_user)
   Soporta tres métodos de autenticación (en orden de prioridad):
   a) JWT Bearer token → Authorization: Bearer <token>
   b) API Key estática → X-API-Key header
   c) Session cookie  → Fallback para compatibilidad

¿Qué es JWT?
   JWT es un estándar abierto (RFC 7519) que permite transmitir información
   de forma segura entre dos partes como un objeto JSON firmado digitalmente.
   A diferencia de las sesiones (que requieren estado en el servidor), JWT es
   "stateless": el servidor no necesita almacenar nada, ya que toda la
   información del usuario viaja dentro del token firmado.

   Estructura de un JWT: <header>.<payload>.<signature>
   - Header:    Algoritmo de firma (HS256) y tipo (JWT)
   - Payload:   Datos del usuario (user_id, email, role, expiración)
   - Signature: Firma HMAC del header+payload con la clave secreta

¿Por qué se usa hash para contraseñas?
   Almacenar contraseñas en texto plano es un riesgo de seguridad grave.
   Si la base de datos es comprometida, todas las contraseñas quedan expuestas.
   Con bcrypt, se guarda un hash irreversible: se puede verificar una contraseña
   comparándola con el hash, pero no se puede recuperar la contraseña original
   desde el hash. Además, bcrypt incluye un "salt" aleatorio y un factor de
   costo configurable, lo que lo hace resistente a ataques de fuerza bruta.

TODO futuro:
- Implementar refresh tokens para renovar access tokens sin re-login
- Añadir blacklist de tokens (para logout efectivo con JWT)
- Implementar rate limiting en intentos de autenticación
- Añadir soporte para OAuth2 / Social Login
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.setting import Setting
from app.models.user import User

# Logger para registrar eventos de autenticación
logger = logging.getLogger("uvicorn.error")


# ══════════════════════════════════════════════════════════════════════
# HASHING DE CONTRASEÑAS — bcrypt via passlib
# ══════════════════════════════════════════════════════════════════════

# CryptContext de passlib configurado con bcrypt como esquema de hashing.
# "deprecated=auto" permite migrar automáticamente hashes antiguos
# a la versión más reciente del algoritmo cuando se verifican.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si una contraseña en texto plano coincide con un hash bcrypt.

    Usa passlib para comparar de forma segura (timing-safe comparison),
    evitando ataques de temporización.

    Parámetros:
    - plain_password:  Contraseña que el usuario escribió en el login
    - hashed_password: Hash bcrypt almacenado en la tabla 'users'

    Retorna:
    - True si coinciden, False si no
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Genera un hash bcrypt de una contraseña en texto plano.

    Se usa al crear un usuario (cuando se aprueba una solicitud de acceso).
    El hash incluye un salt aleatorio generado automáticamente por bcrypt.

    Parámetros:
    - password: Contraseña en texto plano

    Retorna:
    - String con el hash bcrypt (ej: "$2b$12$...")
    """
    return pwd_context.hash(password)


# ══════════════════════════════════════════════════════════════════════
# JWT — Generación y verificación de tokens
# ══════════════════════════════════════════════════════════════════════


def create_access_token(
    user_id: int,
    email: str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Genera un JWT (JSON Web Token) firmado con los datos del usuario.

    El token contiene:
    - sub:      ID del usuario (claim estándar "subject")
    - email:    Email del usuario
    - role:     Rol del usuario ('admin' o 'gestor')
    - exp:      Timestamp de expiración (claim estándar)

    Parámetros:
    - user_id:       ID del usuario autenticado
    - email:         Email del usuario
    - role:          Rol del usuario ('admin' o 'gestor')
    - expires_delta: Duración del token (default: ACCESS_TOKEN_EXPIRE_MINUTES)

    Retorna:
    - String con el token JWT firmado

    El token se firma con HMAC-SHA256 usando la clave secreta de config.
    Solo el servidor puede verificar su autenticidad, ya que solo él
    conoce la clave secreta.

    TODO: Implementar refresh tokens para renovar el access token
    sin pedir al usuario que haga login de nuevo.
    """
    # Calcular la fecha de expiración del token
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    # Payload del token — datos que viajan dentro del JWT
    # "sub" (subject) es un claim estándar de JWT que identifica al usuario
    payload = {
        "sub": str(user_id),  # Subject: ID del usuario (como string por convención JWT)
        "email": email,
        "role": role,
        "exp": expire,        # Expiration: cuándo caduca el token
    }

    # Firmar el payload con la clave secreta y el algoritmo configurado
    # jose.jwt.encode() genera: base64(header).base64(payload).signature
    encoded_jwt = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    logger.info(f"[auth] Token JWT generado para user_id={user_id} ({email})")
    return encoded_jwt


def _decode_jwt(token: str) -> dict | None:
    """
    Decodifica y verifica un token JWT.

    Parámetros:
    - token: String con el JWT recibido del cliente

    Retorna:
    - Dict con el payload decodificado si es válido
    - None si el token es inválido, expirado, o tiene firma incorrecta

    La función jose.jwt.decode() verifica automáticamente:
    1. La firma del token (usando la clave secreta)
    2. La fecha de expiración (claim "exp")
    Si cualquier verificación falla, lanza JWTError.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as e:
        logger.warning(f"[auth] Token JWT inválido: {e}")
        return None


# ══════════════════════════════════════════════════════════════════════
# EXTRACCIÓN DE TOKENS — Helpers para headers HTTP
# ══════════════════════════════════════════════════════════════════════


def _extract_bearer(header: str | None) -> str | None:
    """
    Extrae el token de un header 'Authorization: Bearer <token>'.

    Parámetros:
    - header: Valor del header Authorization (puede ser None)

    Retorna:
    - El token sin el prefijo "Bearer " si está presente
    - None si el header no existe o no tiene el formato correcto
    """
    if header and header.lower().startswith("bearer "):
        return header[7:]
    return None


# ══════════════════════════════════════════════════════════════════════
# AUTENTICACIÓN — Obtener el usuario actual de la request
# ══════════════════════════════════════════════════════════════════════


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependencia de FastAPI que obtiene el usuario autenticado.

    Intenta autenticar la request usando tres métodos en orden de prioridad:

    1. JWT Bearer Token (Authorization: Bearer <jwt_token>)
       - Decodifica el JWT y busca el usuario por ID del payload
       - Método principal para el frontend SPA

    2. API Key estática (X-API-Key: <key> o Authorization: Bearer <api_key>)
       - Compara con la clave almacenada en la tabla 'settings'
       - Para integraciones externas (webhooks, scripts)

    3. Session Cookie (fallback para compatibilidad)
       - Lee user_id de la sesión del servidor
       - Mantiene compatibilidad con el flujo de login anterior

    Si ningún método autentica al usuario, se lanza HTTP 401.

    Uso como dependencia:
        @router.get("/protected")
        async def protected_endpoint(user: CurrentUser):
            return {"email": user.email}
    """

    # ── Método 1: JWT Bearer Token ──
    # El frontend envía: Authorization: Bearer <jwt_token>
    # Intentamos decodificar como JWT primero
    bearer_token = _extract_bearer(request.headers.get("Authorization"))
    if bearer_token:
        # Intentar decodificar como JWT
        payload = _decode_jwt(bearer_token)
        if payload:
            # JWT válido — extraer el user_id del claim "sub"
            user_id_str = payload.get("sub")
            if user_id_str:
                try:
                    user_id = int(user_id_str)
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token JWT inválido: sub no es un ID válido",
                    )
                result = await db.execute(
                    select(User).where(User.id == user_id)
                )
                user = result.scalar_one_or_none()
                if user:
                    # ── Verificar borrado lógico ──
                    # Si el usuario fue eliminado (is_active=False), su JWT
                    # sigue siendo técnicamente válido hasta que expire.
                    # Pero aquí bloqueamos el acceso para que un usuario
                    # eliminado no pueda seguir operando el sistema.
                    if not user.is_active:
                        logger.warning(
                            f"[auth] Usuario desactivado intentó autenticarse: "
                            f"user_id={user_id}"
                        )
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Usuario desactivado. Contacte al administrador.",
                        )
                    return user
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuario del token no encontrado",
                )

        # Si no es un JWT válido, intentar como API Key
        # (el token podría ser una API key, no un JWT)

    # ── Método 2: API Key estática ──
    # Soporta: X-API-Key header o Authorization: Bearer <api_key>
    api_key = request.headers.get("X-API-Key") or bearer_token
    if api_key:
        result = await db.execute(
            select(Setting).where(Setting.key == "crm_api_key")
        )
        setting = result.scalar_one_or_none()
        if setting and setting.value == api_key:
            # API key válida — retornar el primer usuario como "sistema"
            user_result = await db.execute(select(User).limit(1))
            user = user_result.scalar_one_or_none()
            if user:
                return user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key inválida",
        )

    # ── Método 3: Session Cookie (fallback) ──
    # Mantiene compatibilidad con el flujo de login basado en sesiones
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado. Proporcione un token JWT, API key, o inicie sesión.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario de la sesión no encontrado",
        )

    return user


# Tipo anotado para usar como dependencia en endpoints protegidos
# Uso: async def endpoint(user: CurrentUser)
CurrentUser = Annotated[User, Depends(get_current_user)]


# ══════════════════════════════════════════════════════════════════════
# AUTORIZACIÓN — Control de acceso basado en roles (RBAC)
# ══════════════════════════════════════════════════════════════════════
#
# ¿Por qué usar dependencias de FastAPI para RBAC?
#   FastAPI permite "encadenar" dependencias. require_admin depende de
#   get_current_user, así que al inyectar require_admin en un endpoint:
#     1. Primero se ejecuta get_current_user → autentica y obtiene el User
#     2. Luego require_admin verifica el rol del User
#   Esto es más limpio que poner un "if" en cada endpoint, porque:
#     - Es declarativo: el endpoint declara QUÉ necesita, no CÓMO verificarlo
#     - Es reutilizable: se usa con `Depends(require_admin)` en cualquier endpoint
#     - Es composable: se puede combinar con otras dependencias
#     - Es testeable: se puede sustituir en tests con override_dependencies
#
# TODO futuro: Añadir más roles ("supervisor", "viewer") con helpers similares
# ══════════════════════════════════════════════════════════════════════


async def require_admin(
    current_user: CurrentUser,
) -> User:
    """
    Dependencia de FastAPI que verifica que el usuario autenticado sea admin.

    Flujo:
    1. get_current_user autentica al usuario (JWT, API key, o sesión)
    2. Esta función verifica que user.role == "admin"
    3. Si no es admin → HTTP 403 Forbidden
    4. Si es admin → retorna el objeto User para uso en el endpoint

    Uso:
        @router.get("/admin-only")
        async def admin_endpoint(admin: AdminUser):
            return {"admin_email": admin.email}

    ¿Por qué 403 y no 401?
    - 401 (Unauthorized): "No sé quién eres" → falta de autenticación
    - 403 (Forbidden): "Sé quién eres, pero no tienes permiso" → falta de autorización
    El usuario YA está autenticado (get_current_user lo verificó), pero su rol
    no tiene los privilegios necesarios.
    """
    if current_user.role != "admin":
        logger.warning(
            f"[auth] Acceso denegado: usuario {current_user.email} "
            f"(role={current_user.role}) intentó acceder a recurso de admin"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requiere rol de administrador.",
        )
    return current_user


# Tipo anotado para endpoints que requieren rol admin
# Uso: async def endpoint(admin: AdminUser)
AdminUser = Annotated[User, Depends(require_admin)]
