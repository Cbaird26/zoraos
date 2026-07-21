from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

from configs.settings import settings

from .routes import agents, chat, health, memory, system, tools
from .security import authorize_api_request

logger = logging.getLogger("zoraos.api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info(f"ZoraOS v0.1.0 starting in {settings.environment} mode")
    logger.info(f"Default provider: {settings.default_provider}, model: {settings.default_model}")
    logger.info(f"Data directory: {settings.data_path}")
    yield
    logger.info("ZoraOS shutting down")


app = FastAPI(
    title="ZoraOS API",
    description="Local-first AI operating system for research, coding, and knowledge management",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def enforce_api_access(request: Request, call_next):
    path = request.url.path.rstrip("/")
    is_protected = path.startswith("/api/v1") and path != "/api/v1/health"
    if is_protected:
        client_host = request.client.host if request.client else None
        allowed, status_code, detail = authorize_api_request(
            configured_secret=settings.gateway_secret_key,
            supplied_secret=request.headers.get("X-ZoraOS-Key"),
            client_host=client_host,
        )
        if not allowed:
            return JSONResponse(status_code=status_code, content={"detail": detail})
    return await call_next(request)


app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(agents.router, prefix="/api/v1", tags=["agents"])
app.include_router(memory.router, prefix="/api/v1", tags=["memory"])
app.include_router(tools.router, prefix="/api/v1", tags=["tools"])
app.include_router(system.router, prefix="/api/v1", tags=["system"])


@app.get("/")
async def root():
    return {"name": "ZoraOS", "version": "0.1.0", "status": "running"}
