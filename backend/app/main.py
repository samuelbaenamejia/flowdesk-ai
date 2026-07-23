from fastapi import FastAPI

from app.api.v1 import router as v1_router
from app.core.config import settings
from app.core.logging import setup_logging

setup_logging()

app = FastAPI(title="FlowDesk-AI API", version="0.1.0")

app.include_router(v1_router)


@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.environment}
