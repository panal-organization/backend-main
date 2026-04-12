from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="Panal AI Service")
    app_version: str = Field(default="0.1.0")
    environment: str = Field(default="development")

    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)

    internal_api_key: str = Field(default="change-this-in-production")

    ollama_base_url: str = Field(default="http://localhost:11434")
    ollama_model: str = Field(default="qwen2.5:7b")
    ollama_timeout_seconds: float = Field(default=60.0)


@lru_cache
def get_settings() -> Settings:
    return Settings()
