# Portable RAG Backend Module

This folder contains the portable RAG backend that can be mounted into an existing FastAPI app.

## Included Features

- Notebook-oriented RAG chat sessions over indexed source chunks.
- Source ingestion from:
  - raw text,
  - URL pages,
  - uploaded files (txt, md, csv, pdf, docx, audio/video via STT).
- Provider support for chat/embeddings:
  - local (Ollama),
  - LM Studio (OpenAI-compatible /v1 API),
  - Gemini.
- Speech tooling:
  - STT via faster-whisper,
  - optional Deepgram STT fallback/provider,
  - TTS via gTTS.
- Local Chroma vector persistence.
- Local SQLite metadata persistence.
- In-process persisted background jobs.
- Prompt templates, notes, audio overview, and podcast handoff routes.

## Folder Layout

- portable_rag_backend/config.py: settings and environment variable mappings.
- portable_rag_backend/bootstrap.py: service wiring.
- portable_rag_backend/integration.py: mount helpers for host FastAPI app.
- portable_rag_backend/api/router.py: endpoint definitions.
- portable_rag_backend/providers/: LLM, embeddings, speech adapters.
- portable_rag_backend/services/: source/chat/model orchestration.
- portable_rag_backend/storage/: SQLite metadata and Chroma vector storage.
- portable_rag_backend/utils/: extractors and chunking utilities.

## Quick Start (This Repository)

1. Install dependencies from repo root:

```bash
pip install -r Backend/handoff_fastapi/requirements.txt
```

2. Copy sample env and edit values:

```bash
copy Backend/handoff_fastapi/.env.example .env
```

3. Mount into your FastAPI app:

```python
from fastapi import FastAPI
from portable_rag_backend.integration import include_portable_rag_backend

app = FastAPI()
include_portable_rag_backend(app, prefix="/rag")
```

4. Run your host app.

For full integration details with Mongo-backed host systems, see `INTEGRATION_FASTAPI_MONGODB.md`.

## Key Environment Variables

- `PORTABLE_DATA_DIR`
- `DEFAULT_CHAT_PROVIDER`, `DEFAULT_EMBEDDING_PROVIDER`
- `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`, `LOCAL_EMBEDDING_MODEL`
- `LMSTUDIO_BASE_URL`, `LMSTUDIO_API_KEY`, `LMSTUDIO_CHAT_MODEL`, `LMSTUDIO_EMBEDDING_MODEL`
- `GOOGLE_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL`
- `REMOTE_API_BASE_URL` (optional podcast forwarding)

Speech variables:

- `STT_PROVIDER`: `auto`, `whisper`, or `deepgram`
- `DEEPGRAM_API_KEY`
- `DEEPGRAM_STT_MODEL` (default `nova-3`)
- `DEEPGRAM_BASE_URL` (default `https://api.deepgram.com/v1`)
- `WHISPER_MODEL_SIZE`
- `TTS_LANGUAGE`

`STT_PROVIDER=auto` tries Whisper first, then Deepgram when configured.

## API Surface

See `API_REFERENCE.md` for full endpoint matrix and schema details.

Core groups when mounted at `/rag`:

- Health and models
- Notebooks and notebook-source links
- Notes and prompts
- Sources and vector DB
- Search and chat sessions
- Jobs and speech endpoints
- Audio overview and podcast generation/status

## Notes

- This module remains storage-independent from host Mongo entities.
- Host apps should apply auth/rate limiting to mounted routes.
- For multi-replica production deployments, consider externalizing job execution.
