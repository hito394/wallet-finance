from functools import lru_cache
import json
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = Field(default="AI Finance Assistant API", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    api_prefix: str = Field(default="/api/v1", alias="API_PREFIX")
    database_url: str = Field(alias="DATABASE_URL")
    file_storage_root: Path = Field(default=Path("./storage"), alias="FILE_STORAGE_ROOT")
    default_currency: str = Field(default="USD", alias="DEFAULT_CURRENCY")
    ocr_engine: str = Field(default="tesseract", alias="OCR_ENGINE")
    max_upload_mb: int = Field(default=25, alias="MAX_UPLOAD_MB")
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["*"], alias="CORS_ORIGINS")
    trusted_hosts: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["*"], alias="TRUSTED_HOSTS")

    # Plaid (optional – leave empty to disable bank sync feature)
    plaid_client_id: str = Field(default="", alias="PLAID_CLIENT_ID")
    plaid_secret: str     = Field(default="", alias="PLAID_SECRET")
    plaid_env: str        = Field(default="sandbox", alias="PLAID_ENV")  # sandbox | development | production

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        if not isinstance(value, str):
            return value

        # Render often provides postgres:// or postgresql:// URLs without a driver.
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @field_validator("cors_origins", "trusted_hosts", mode="before")
    @classmethod
    def _parse_csv_env(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            # Support JSON array values when entered in cloud env UIs.
            stripped = value.strip()
            if stripped.startswith("[") and stripped.endswith("]"):
                try:
                    parsed = json.loads(stripped)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()] or ["*"]
                except json.JSONDecodeError:
                    pass

            values = [item.strip() for item in value.split(",") if item.strip()]
            return values or ["*"]
        return ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
