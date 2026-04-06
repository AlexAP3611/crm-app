from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://crm_user:abc123.@localhost:5432/crm"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    DEBUG: bool = True

    # ── JWT — Configuración de tokens de autenticación ──
    # JWT (JSON Web Token) es un estándar abierto (RFC 7519) para transmitir
    # información segura entre partes como un objeto JSON firmado.
    # Se usa aquí para autenticar usuarios sin necesidad de mantener sesiones
    # en el servidor (stateless authentication).
    #
    # SECRET_KEY: Clave secreta para firmar los tokens (CAMBIAR en producción)
    # ALGORITHM: Algoritmo de firma (HS256 = HMAC con SHA-256)
    # EXPIRE_MINUTES: Tiempo de vida del token en minutos
    #
    # TODO: En producción, usar una clave secreta larga y aleatoria
    # generada con: python -c "import secrets; print(secrets.token_urlsafe(64))"
    JWT_SECRET_KEY: str = "crm_jwt_secret_key_change_me_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hora

    # ── Logs — Configuración de retención y limpieza ──
    # Número de días que se conservan los logs antes de poder eliminarlos.
    # La limpieza se puede ejecutar manualmente vía DELETE /api/logs/cleanup
    # o automáticamente vía cron job externo.
    # Mínimo recomendado: 30 días (para cumplimiento y auditoría)
    # TODO: ajustar según necesidades del negocio
    LOG_RETENTION_DAYS: int = 90


settings = Settings()
