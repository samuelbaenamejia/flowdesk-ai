import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1 import router as v1_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.security import validate_settings

setup_logging()
validate_settings()


async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex[:12])
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


app = FastAPI(title="FlowDesk-AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(BaseHTTPMiddleware, dispatch=add_request_id)

app.include_router(v1_router)


@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.environment}
