from __future__ import annotations

from fastapi import FastAPI

from portable_rag_backend.api.router import build_router
from portable_rag_backend.bootstrap import PortableRAGBackend, create_backend
from portable_rag_backend.config import PortableRAGSettings


def include_portable_rag_backend(
    app: FastAPI,
    *,
    prefix: str = "/rag",
    settings: PortableRAGSettings | None = None,
) -> PortableRAGBackend:
    backend = create_backend(settings)
    app.include_router(build_router(backend), prefix=prefix, tags=["portable-rag"])
    return backend


def create_standalone_app(
    *,
    prefix: str = "",
    settings: PortableRAGSettings | None = None,
) -> FastAPI:
    app = FastAPI(title="Portable RAG Backend")
    include_portable_rag_backend(app, prefix=prefix, settings=settings)
    return app
