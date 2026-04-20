# Portable RAG Backend Module

This folder is a plug-and-play backend module extracted for integration into an existing FastAPI project.

## Included Features

- RAG chat sessions with retrieval over indexed source chunks.
- Source extraction and ingestion from:
  - raw text,
  - URL pages,
  - uploaded files (txt, md, csv, pdf, docx, audio/video via STT).
- Model handling restricted to:
  - local LLMs (Ollama),
  - Gemini API.
- Embeddings restricted to:
  - local sentence-transformer embeddings,
  - Gemini embeddings.
- Speech tooling:
  - STT via `faster-whisper`,
  - TTS via `gTTS`.
- Vector search using local Chroma persistence.
- Metadata persistence using local SQLite.
- Lightweight persisted background jobs for non-blocking ingestion.
- Custom prompt templates for chat-system behavior.
- Prompt bootstrap endpoint for recommended defaults.
- Notes and insights persistence linked to notebooks/sources.
- Audio overview workflow with background generation and status retrieval.
- Podcast generation handoff endpoint with remote API forwarding or local fallback.
- Notebook/source linking lifecycle (link, unlink, notebook delete with safe source retention).
- Resource guardrails (upload size limits, extension validation, source limits).
- Explicit vector DB init/stats/rebuild APIs (sync + async).

## Folder Layout

- portable_rag_backend/config.py: settings and path resolution.
- portable_rag_backend/bootstrap.py: creates all module services.
- portable_rag_backend/integration.py: mount helpers for your FastAPI app.
- portable_rag_backend/api/router.py: backend API endpoints.
- portable_rag_backend/providers/: local/Gemini model and speech adapters.
- portable_rag_backend/services/: source, chat, and model orchestration.
- portable_rag_backend/storage/: SQLite metadata and Chroma vector persistence.
- portable_rag_backend/utils/: text chunking and extraction helpers.

## Quick Start

1. Install dependencies:

```bash
pip install -r portable_backend_module/handoff_fastapi/requirements.txt
```

2. Create your env file using the sample:

```bash
copy portable_backend_module/handoff_fastapi/.env.example .env
```

Optional: set `REMOTE_API_BASE_URL` (for example `http://localhost:5055/api`) to forward
`/rag/podcasts/generate` and `/rag/podcasts/jobs/{job_id}` to a full Open Notebook API.

3. Mount into your FastAPI app:

```python
from fastapi import FastAPI
from portable_rag_backend.integration import include_portable_rag_backend

app = FastAPI()
include_portable_rag_backend(app, prefix="/rag")
```

4. Run your app as usual.

For production-style integration with existing FastAPI + MongoDB systems, see:
`INTEGRATION_FASTAPI_MONGODB.md`

# Portable RAG Backend Module

This folder is a plug-and-play backend module extracted for integration into an existing FastAPI project.

## Included Features

- RAG chat sessions with retrieval over indexed source chunks.
- Source extraction and ingestion from:
  - raw text,
  - URL pages,
  - uploaded files (txt, md, csv, pdf, docx, audio/video via STT).
- Model handling restricted to:
  - local LLMs (Ollama),
  - Gemini API.
- Embeddings restricted to:
  - local sentence-transformer embeddings,
  - Gemini embeddings.
- Speech tooling:
  - STT via `faster-whisper`,
  - TTS via `gTTS`.
- Vector search using local Chroma persistence.
- Metadata persistence using local SQLite.
- Lightweight persisted background jobs for non-blocking ingestion.
- Custom prompt templates for chat-system behavior.
- Prompt bootstrap endpoint for recommended defaults.
- Notes and insights persistence linked to notebooks/sources.
- Audio overview workflow with background generation and status retrieval.
- Podcast generation handoff endpoint with remote API forwarding or local fallback.
- Notebook/source linking lifecycle (link, unlink, notebook delete with safe source retention).
- Resource guardrails (upload size limits, extension validation, source limits).
- Explicit vector DB init/stats/rebuild APIs (sync + async).

## Folder Layout

- portable_rag_backend/config.py: settings and path resolution.
- portable_rag_backend/bootstrap.py: creates all module services.
- portable_rag_backend/integration.py: mount helpers for your FastAPI app.
- portable_rag_backend/api/router.py: backend API endpoints.
- portable_rag_backend/providers/: local/Gemini model and speech adapters.
- portable_rag_backend/services/: source, chat, and model orchestration.
- portable_rag_backend/storage/: SQLite metadata and Chroma vector persistence.
- portable_rag_backend/utils/: text chunking and extraction helpers.

## Quick Start

1. Install dependencies:

```bash
pip install -r portable_backend_module/requirements.txt
```

2. Create your env file using the sample:

```bash
copy portable_backend_module/.env.example .env
```

Optional: set `REMOTE_API_BASE_URL` (for example `http://localhost:5055/api`) to forward
`/rag/podcasts/generate` and `/rag/podcasts/jobs/{job_id}` to a full Open Notebook API.

3. Mount into your FastAPI app:

```python
from fastapi import FastAPI
from portable_rag_backend.integration import include_portable_rag_backend

app = FastAPI()
include_portable_rag_backend(app, prefix="/rag")
```

4. Run your app as usual.

For production-style integration with existing FastAPI + MongoDB systems, see:
`INTEGRATION_FASTAPI_MONGODB.md`

## API Surface

Full endpoint matrix with request/response schemas:
`API_REFERENCE.md`

- `GET /rag/health`
- `POST /rag/notebooks`
- `GET /rag/notebooks`
- `GET /rag/notebooks/{notebook_id}`
- `DELETE /rag/notebooks/{notebook_id}`
- `POST /rag/notebooks/{notebook_id}/sources`
- `DELETE /rag/notebooks/{notebook_id}/sources/{source_id}`
- `GET /rag/notebooks/{notebook_id}/notes`
- `POST /rag/notebooks/{notebook_id}/notes`
- `PATCH /rag/notes/{note_id}`
- `DELETE /rag/notes/{note_id}`
- `POST /rag/notebooks/{notebook_id}/audio-overview`
- `GET /rag/notebooks/{notebook_id}/audio-overview`
- `POST /rag/podcasts/generate`
- `GET /rag/podcasts/jobs/{job_id}`
- `GET /rag/prompts`
- `GET /rag/prompts/{name}`
- `PUT /rag/prompts/{name}`
- `POST /rag/prompts/bootstrap-defaults`
- `GET /rag/resources/stats`
- `POST /rag/sources/text`
- `POST /rag/sources/text/async`
- `POST /rag/sources/url`
- `POST /rag/sources/url/async`
- `POST /rag/sources/file`
- `POST /rag/sources/file/async`
- `GET /rag/sources`
- `GET /rag/sources/{source_id}`
- `DELETE /rag/sources/{source_id}`
- `POST /rag/vector-db/init`
- `GET /rag/vector-db/stats`
- `POST /rag/vector-db/rebuild`
- `POST /rag/vector-db/rebuild/async`
- `POST /rag/search`
- `POST /rag/chat/sessions`
- `GET /rag/chat/sessions`
- `GET /rag/chat/sessions/{session_id}`
- `POST /rag/chat/sessions/{session_id}/messages`
- `GET /rag/models`
- `GET /rag/jobs`
- `GET /rag/jobs/{job_id}`
- `POST /rag/speech/transcribe`
- `POST /rag/speech/synthesize`

If you are building a frontend integration, start with:

1. `API_REFERENCE.md` for method/path/body/response mapping.
2. Host app `/openapi.json` for generated machine-readable schema.

## Notes

- This module is intentionally self-contained and does not depend on SurrealDB.
- It is designed for easy adoption inside an existing backend; mount and use.
- For production workloads, add auth, rate limiting, and request size limits in your host app.
