from fastapi import FastAPI

from portable_rag_backend.integration import include_portable_rag_backend


app = FastAPI(title="Host Backend")

# Mount all portable RAG routes under /rag
include_portable_rag_backend(app, prefix="/rag")


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}
from fastapi import FastAPI

from portable_rag_backend.integration import include_portable_rag_backend


app = FastAPI(title="Host Backend")

# Mount all portable RAG routes under /rag
include_portable_rag_backend(app, prefix="/rag")


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}
