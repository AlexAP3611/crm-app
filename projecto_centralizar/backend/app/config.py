from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://crm_user:abc123.@localhost:5432/crm"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    DEBUG: bool = True


settings = Settings()
