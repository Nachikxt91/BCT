"""Trade Document OCR Platform — FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import attestation, auth, health, orgs, packs
from app.core.config import settings
from app.core.db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="LC Document OCR Platform",
    description="Electronics-domain LC pack OCR, extraction, and hash attestation API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(orgs.router, prefix="/api/v1/orgs", tags=["orgs"])
app.include_router(packs.router, prefix="/api/v1/packs", tags=["packs"])
app.include_router(attestation.router, prefix="/api/v1/attestation", tags=["attestation"])
