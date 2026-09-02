from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parents[4]  # BCT/
DATA = ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    app_public_url: str = "http://localhost:3000"

    # Prefer Postgres (Neon free / Docker). SQLite fallback for local zero-setup.
    database_url: str = f"sqlite:///{(DATA / 'ocr_platform.db').as_posix()}"
    upload_dir: Path = DATA / "uploads"
    ocr_dir: Path = DATA / "ocr"

    # Auth
    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_access_minutes: int = 15
    jwt_refresh_days: int = 7
    password_reset_hours: int = 1
    email_verify_hours: int = 24

    # Optional SMTP (Resend / Gmail / Mailtrap). Dev logs links if unset.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "TradeDoc <noreply@tradedoc.local>"
    smtp_use_tls: bool = True

    # LLM
    groq_api_key: str | None = None
    gemini_api_key: str | None = None
    groq_classify_model: str = "llama-3.1-8b-instant"
    groq_extract_model: str = "openai/gpt-oss-20b"
    groq_vision_model: str = "qwen/qwen3.6-27b"
    gemini_vision_model: str = "gemini-2.5-flash"

    ocr_confidence_threshold: float = 0.75
    max_vision_pages_per_pack: int = 10
    max_upload_mb: int = 50

    # Chain (optional — mock if unset)
    chain_rpc_url: str | None = None
    attestation_contract_address: str | None = None
    attester_private_key: str | None = None

    llm_max_retries: int = 3
    llm_backoff_base_seconds: float = 1.0

    # Seed defaults
    seed_admin_email: str = "admin@example.com"
    seed_admin_password: str = "Admin123!"
    seed_org_name: str = "TradeDoc Demo"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.upload_dir.mkdir(parents=True, exist_ok=True)
    s.ocr_dir.mkdir(parents=True, exist_ok=True)
    return s


settings = get_settings()
