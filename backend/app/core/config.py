from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    backend_port: int = 8000
    database_url: str
    whatsapp_verify_token: str = ""
    whatsapp_phone_number_id: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
