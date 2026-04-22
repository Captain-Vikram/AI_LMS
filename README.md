# Quasar EduSaarthi

A full-stack classroom learning platform with:

- React + Vite frontend
- FastAPI backend
- MongoDB data store
- Local-first AI flows (LM Studio), with fallbacks in several features

This repository previously had many overlapping docs. It is now intentionally minimal.

## Tech Stack

- Frontend: React 19, Vite, React Query, Tailwind
- Backend: FastAPI, PyMongo, JWT auth
- Database: MongoDB
- AI integrations: LM Studio, YouTube and deep-research flows

## Quick Start

### 1) Backend

```powershell
cd Backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend is available at:

- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

### 2) Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend dev server runs on Vite default port (usually http://localhost:5173).

## Environment Variables

Create a `.env` for backend values.

Common values used by backend code:

- `MONGO_URI` (default fallback: `mongodb://localhost:27017/quasar`)
- `SECRET_KEY`
- `JWT_ALGORITHM` (optional, default `HS256`)
- `LMSTUDIO_URL` (optional, default `http://127.0.0.1:1234`)
- `LMSTUDIO_MODEL` (optional)
- `LMSTUDIO_API_KEY` or `LMSTUDIO_API_TOKEN` (optional for LM Studio features)

Portable RAG integration values (new):

- `PORTABLE_DATA_DIR` (default `./data/portable_rag`)
- `VECTOR_DB_API_BASE_URL` (optional external vector DB/API URL, recommended host port `18001`)
- `DEFAULT_CHAT_PROVIDER` (`local`, `lmstudio`, `gemini`)
- `DEFAULT_EMBEDDING_PROVIDER` (`local`, `lmstudio`, `gemini`)
- `LMSTUDIO_BASE_URL` (OpenAI-compatible endpoint, usually `http://localhost:1234/v1`)
- `LMSTUDIO_CHAT_MODEL` (`auto` recommended)
- `LMSTUDIO_EMBEDDING_MODEL` (`auto` recommended)
- `GOOGLE_API_KEY` (only when Gemini is used)
- `STT_PROVIDER` (`auto`, `whisper`, `deepgram`; `auto` is recommended)
- `DEEPGRAM_API_KEY` (required only when using Deepgram STT directly or as fallback)
- `DEEPGRAM_STT_MODEL` (default `nova-3`)
- `DEEPGRAM_BASE_URL` (default `https://api.deepgram.com/v1`)
- `WHISPER_MODEL_SIZE` and `TTS_LANGUAGE` for speech endpoints

Frontend API base URL (optional):

- `VITE_API_URL` (default `http://localhost:8000`)

## Core Paths

- Backend entrypoint: `Backend/main.py`
- Frontend API config: `frontend/src/config/api.js`
- Primary route modules: `Backend/routes/`
- Portable RAG module: `Backend/handoff_fastapi/portable_rag_backend/`

## Portable RAG in Current Backend

The portable RAG backend is mounted under:

- `GET /api/portable-rag/health`
- `POST /api/portable-rag/vector-db/init`
- `GET /api/portable-rag/vector-db/stats`
- `POST /api/portable-rag/sources/*`
- `POST /api/portable-rag/chat/sessions/*`

Startup sequence for first-time setup:

1. Start MongoDB (`quasar-mongo`) and your FastAPI backend.
2. Ensure `PORTABLE_DATA_DIR` points to persistent storage.
3. Create a notebook with `POST /api/portable-rag/notebooks`.
4. Add sources (`/sources/text`, `/sources/url`, `/sources/file`).
5. Initialize vectors with `POST /api/portable-rag/vector-db/init`.
6. Optionally rebuild vectors with `POST /api/portable-rag/vector-db/rebuild` after source changes.

Storage model (important):

- MongoDB remains your system-of-record for existing app entities.
- Portable RAG metadata is stored in SQLite under `PORTABLE_DATA_DIR`.
- Portable RAG embeddings are stored in Chroma under `PORTABLE_DATA_DIR/vector_store`.

No mandatory transfer from vector DB to MongoDB is required for this integration. If you want mirrored analytics in MongoDB, add a dedicated sync job instead of replacing Chroma.

## Docker Setup (Database)

Backend stays on `8000` by default. To avoid collisions, run vector DB on a different host port.

Preferred (MongoDB + Vector DB together):

```powershell
docker compose -f docker-compose.infra.yml up -d
```

DB-only lifecycle commands:

```powershell
# Start only MongoDB + Vector DB
docker compose -f docker-compose.infra.yml up -d

# Check status
docker compose -f docker-compose.infra.yml ps

# View logs
docker compose -f docker-compose.infra.yml logs -f

# Stop containers
docker compose -f docker-compose.infra.yml stop

# Stop and remove containers/network (keeps data)
docker compose -f docker-compose.infra.yml down
```

Default host ports in `docker-compose.infra.yml`:

- MongoDB: `27017 -> 27017`
- Vector DB (SurrealDB): `18001 -> 8000`

You can override ports at runtime without editing files:

```powershell
$env:MONGO_HOST_PORT = "27017"
$env:VECTOR_DB_HOST_PORT = "18001"
docker compose -f docker-compose.infra.yml up -d
```

This keeps backend `:8000` isolated even if vector DB startup/config fails.

**Default connection string** (if not using auth):

```
mongodb://localhost:27017/quasar
```

**With auth:**

```
mongodb://root:password@localhost:27017/quasar
```

Set `MONGO_URI` in `.env` to match your setup.

If you want backend health checks and portable RAG health metadata to track your vector endpoint, set:

```env
VECTOR_DB_API_BASE_URL=http://127.0.0.1:18001
```

## Documentation

- API summary: `docs/API_REFERENCE.md`

That is the complete maintained doc set.
