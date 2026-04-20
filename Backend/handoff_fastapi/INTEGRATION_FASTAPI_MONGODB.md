# FastAPI + MongoDB Integration Guide (Portable RAG Handoff)

This guide explains all dependencies and integration changes needed to run the portable RAG module inside an existing FastAPI backend that already uses MongoDB.

## 1. Architecture and Coexistence

The portable RAG module is intentionally self-contained:

- Existing system of record: MongoDB (your current backend data).
- Portable RAG metadata: SQLite (`metadata.db`) inside `PORTABLE_DATA_DIR`.
- Portable RAG vectors: Chroma local persistence inside `PORTABLE_DATA_DIR/vector_store`.
- Portable RAG uploads/audio: local files inside `PORTABLE_DATA_DIR/uploads` and `PORTABLE_DATA_DIR/audio`.

No MongoDB schema changes are required for basic integration.

## 2. Python Dependencies

Install the module dependencies into the same virtual environment as your FastAPI app.

```bash
pip install -r Backend/handoff_fastapi/requirements.txt
```

Dependencies included by this module:

- `fastapi`
- `pydantic`
- `pydantic-settings`
- `langchain-core`
- `langchain-chroma`
- `langchain-text-splitters`
- `langchain-ollama`
- `langchain-openai`
- `langchain-google-genai`
- `langchain-huggingface`
- `beautifulsoup4`
- `httpx`
- `pypdf`
- `python-docx`
- `faster-whisper`
- `gTTS`
- `sentence-transformers`
- `uvicorn`

Deepgram STT fallback uses `httpx` and does not require a separate Deepgram SDK package.

## 3. System-Level Dependencies

For smooth audio/video ingestion and speech workflows, install these OS-level tools:

1. `ffmpeg`
2. Sufficient disk for models, vectors, uploads, and generated audio
3. Optional runtime:
   - Ollama if using the `local` provider
   - LM Studio if using the `lmstudio` provider

Examples:

```powershell
# Windows (winget)
winget install Gyan.FFmpeg
```

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y ffmpeg
```

## 4. Environment Variables

Use this as a baseline in your host backend `.env`.

```env
# Storage paths
PORTABLE_DATA_DIR=./data/portable_rag

# Chunking / retrieval
DEFAULT_CHUNK_SIZE=1200
DEFAULT_CHUNK_OVERLAP=180
DEFAULT_RETRIEVAL_K=6
CHAT_HISTORY_WINDOW=8
MAX_SOURCE_CHARACTERS=1000000
MAX_UPLOAD_MB=50
ALLOWED_UPLOAD_EXTENSIONS_CSV=.txt,.md,.csv,.json,.pdf,.docx,.html,.xml,.py,.js,.ts,.mp3,.wav,.m4a,.mp4,.mov,.mkv

# Provider defaults
DEFAULT_CHAT_PROVIDER=local
DEFAULT_EMBEDDING_PROVIDER=local

# Local provider (Ollama)
LOCAL_LLM_BASE_URL=http://localhost:11434
LOCAL_LLM_MODEL=llama3.1:8b
LOCAL_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# LM Studio provider (OpenAI-compatible endpoint)
# Keep /v1 suffix for OpenAI-compatible requests.
LMSTUDIO_BASE_URL=http://localhost:1234/v1
# Optional unless LM Studio auth/token is enabled.
LMSTUDIO_API_KEY=
# Optional. Set to auto to detect loaded models from /v1/models.
LMSTUDIO_CHAT_MODEL=auto
LMSTUDIO_EMBEDDING_MODEL=auto

# Gemini provider (optional)
GOOGLE_API_KEY=
GEMINI_CHAT_MODEL=gemini-1.5-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004

# Optional: forward podcast routes to full Open Notebook API
# Supports values with or without /api suffix (both are tried).
REMOTE_API_BASE_URL=http://localhost:5055/api

# Speech
STT_PROVIDER=auto  # whisper | deepgram | auto
DEEPGRAM_API_KEY=
DEEPGRAM_STT_MODEL=nova-3
DEEPGRAM_BASE_URL=https://api.deepgram.com/v1
WHISPER_MODEL_SIZE=base
TTS_LANGUAGE=en

# Prompt fallback
DEFAULT_CHAT_SYSTEM_PROMPT=You are a strictly grounded retrieval assistant. Use only information from the provided Context block. Every factual statement must include one or more inline citations using [n] where n matches a Context citation index. Do not invent facts. Do not invent citations. If context is insufficient, explicitly say what is missing.

# Background jobs
JOB_WORKER_COUNT=2
```

### 4.1 LM Studio Setup (OpenAI-Compatible)

The portable backend uses LM Studio through OpenAI-compatible `/v1/*` endpoints.

1. Start LM Studio local server and enable OpenAI-compatible API.
2. Load at least one chat model and one embedding model in LM Studio.
3. Set these environment variables:

```env
DEFAULT_CHAT_PROVIDER=lmstudio
DEFAULT_EMBEDDING_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_API_KEY=
LMSTUDIO_CHAT_MODEL=auto
LMSTUDIO_EMBEDDING_MODEL=auto
```

4. If `LMSTUDIO_CHAT_MODEL` or `LMSTUDIO_EMBEDDING_MODEL` are left as `auto`, the backend picks models automatically from `GET /v1/models`.
   - For embeddings, the backend scans all loaded models, identifies embedding-capable ones, then selects the top-ranked candidate automatically.
5. Optional: if you keep `DEFAULT_*_PROVIDER=local`, you can still use LM Studio per request by passing `provider="lmstudio"` in chat/audio endpoints.
6. Validate with `GET /rag/models` and confirm `lmstudio.base_url`.

Note about LM Studio native `/api/v1/*`: this handoff backend currently integrates via OpenAI-compatible `/v1/*` routes, not LM Studio native `/api/v1/chat`.

## 5. FastAPI Integration Changes

### 5.1 Add module import path

Ensure your app can import the package from `Backend/handoff_fastapi` (or the equivalent path in your host workspace).

### 5.2 Mount the portable routes

Simple integration:

```python
from fastapi import FastAPI
from portable_rag_backend.integration import include_portable_rag_backend

app = FastAPI()
include_portable_rag_backend(app, prefix="/rag")
```

### 5.3 Mount with auth dependencies (recommended)

If your existing backend already has auth dependencies, mount manually:

```python
from fastapi import Depends, FastAPI
from portable_rag_backend.api.router import build_router
from portable_rag_backend.bootstrap import create_backend

# Example auth dependency from your system
from app.auth import require_authenticated_user

app = FastAPI()
portable_backend = create_backend()
app.include_router(
    build_router(portable_backend),
    prefix="/rag",
    tags=["portable-rag"],
    dependencies=[Depends(require_authenticated_user)],
)
```

### 5.4 API reference for frontend and SDK teams

Use these docs as the API contract for the handoff package:

1. `API_REFERENCE.md` for a compact endpoint matrix (`method`, `path`, `body schema`, `response schema`) and schema quick reference.
2. Host app `/openapi.json` for generated machine-readable OpenAPI schema after mounting.
3. `portable_rag_backend/api/router.py` and `portable_rag_backend/schemas.py` as source of truth.

## 6. MongoDB-Specific Notes

Your MongoDB integration can remain unchanged.

What changes are recommended:

1. Keep portable RAG data directory persistent across restarts.
2. Keep MongoDB and portable storage backups as separate backup jobs.
3. Do not point `PORTABLE_DATA_DIR` to ephemeral container storage.
4. Keep resource ownership and permissions enforced in your host auth layer before allowing `/rag/*` access.

If you want portable RAG metadata in MongoDB instead of SQLite, that requires refactoring `portable_rag_backend/storage/metadata.py` to a Mongo-backed storage implementation and updating the bootstrap wiring.

## 7. Deployment and Reliability Changes

To make this work smoothly in production:

1. Persist `PORTABLE_DATA_DIR` on a durable volume.
2. Set explicit file upload limits in reverse proxy and app gateway.
3. Use request authentication and rate limiting on `/rag/*`.
4. Monitor disk usage (vectors, uploads, audio files can grow quickly).
5. Prefer a single API process for in-process job execution, or move jobs to an external queue if you run many workers/replicas.

Important job behavior:

- Current jobs are in-process thread pool jobs with SQLite status persistence.
- This is fine for small to medium deployments.
- For horizontally scaled deployments, migrate job execution to a shared external worker system.

## 8. Quick Verification Checklist

After integration, verify:

1. `GET /rag/health` returns `ok: true`.
2. Create a notebook: `POST /rag/notebooks`.
3. Add source text: `POST /rag/sources/text`.
4. Query retrieval: `POST /rag/search`.
5. Start chat session and send one message.
6. Trigger one async job (`/rag/sources/text/async` or `/rag/vector-db/rebuild/async`) and verify `/rag/jobs/{job_id}` moves to `completed`.
7. Trigger `POST /rag/podcasts/generate` and verify `GET /rag/podcasts/jobs/{job_id}` returns status updates.
8. Check files are created under `PORTABLE_DATA_DIR`.

## 9. Common Issues

### 9.1 `ModuleNotFoundError: langchain_chroma`

Install dependencies in the active virtual environment:

```bash
pip install -r Backend/handoff_fastapi/requirements.txt
```

### 9.2 Empty audio or transcription failures

- Confirm `ffmpeg` is installed and reachable.
- Validate supported file extensions.
- If Whisper fails or model download is unavailable, set `STT_PROVIDER=deepgram` and configure `DEEPGRAM_API_KEY`.
- For mixed mode, use `STT_PROVIDER=auto` (Whisper first, Deepgram fallback).

### 9.3 Upload rejected or source too large

- Increase `MAX_UPLOAD_MB`.
- Increase `MAX_SOURCE_CHARACTERS`.
- Align proxy upload/body limits with backend limits.

### 9.4 Permission mismatch with existing Mongo auth model

- Apply your existing auth dependency to the `/rag` router.
- Optionally map notebook/source ownership in host-layer authorization checks.

### 9.5 LM Studio model/provider mismatch

- Ensure `DEFAULT_CHAT_PROVIDER` and `DEFAULT_EMBEDDING_PROVIDER` are set to `lmstudio` when expecting LM Studio defaults.
- Prefer `LMSTUDIO_CHAT_MODEL=auto` and `LMSTUDIO_EMBEDDING_MODEL=auto` unless you need to pin exact model IDs.
- If pinning model IDs, confirm they exactly match loaded model IDs in LM Studio.
- Ensure `LMSTUDIO_BASE_URL` includes `/v1` (example: `http://localhost:1234/v1`).
- `LMSTUDIO_API_KEY` is optional for local LM Studio without auth; set it only when LM Studio auth is enabled.

## 10. Recommended Next Enhancements

1. Add API tests in your host backend for the `/rag` route group.
2. Add periodic cleanup/retention policy for uploads and generated audio.
3. Add structured logging around job lifecycle and provider calls.
4. If needed, replace in-process jobs with Celery, RQ, or another shared worker system.
