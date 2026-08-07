from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    backend_port: int = 8000
    database_url: str
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 15
    refresh_token_expire_minutes: int = 10080  # 7 days
    whatsapp_verify_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_access_token: str = ""
    whatsapp_app_secret: str = ""
    whatsapp_graph_api_version: str = "v21.0"
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-70b-versatile"
    groq_max_tokens: int = 500
    groq_temperature: float = 0.7
    groq_history_limit: int = 10
    company_name: str = "FlowDesk"
    groq_system_prompt: str = (
        "Eres un asistente de atención al cliente de {EMPRESA}. "
        "Responde de forma natural, útil y concisa. "
        "Si no sabes algo, di que un agente te atenderá."
    )
    cors_origins: str = "*"
    n8n_enabled: bool = False
    n8n_mode: Literal["disabled", "mirror", "primary"] = "disabled"
    n8n_webhook_url: str | None = None
    internal_api_key: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()