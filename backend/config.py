from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    DATABASE_URL: str = Field(default="postgresql://localhost/exd_control")
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=True)
    CORS_ORIGINS: str = Field(default="http://localhost:5173,http://localhost:3000")
    # Keys de acceso a la API. Vacías en desarrollo = acceso libre en local;
    # en producción son obligatorias (auth.py cierra la API si faltan).
    API_KEY: str = Field(default="")
    ADMIN_API_KEY: str = Field(default="")

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
