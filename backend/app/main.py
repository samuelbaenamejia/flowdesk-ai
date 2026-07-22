from fastapi import FastAPI

from app.core.config import settings
from app.core.logging import setup_logging

setup_logging()

app = FastAPI(title="FlowDesk-AI API", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.environment}
