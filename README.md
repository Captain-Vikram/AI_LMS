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
- Portable RAG module: `handoff_fastapi/portable_rag_backend/`

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

### MongoDB with Docker

Start MongoDB container:

```powershell
docker run -d `
  --name quasar-mongodb `
  -p 27017:27017 `
  -e MONGO_INITDB_ROOT_USERNAME=root `
  -e MONGO_INITDB_ROOT_PASSWORD=password `
  -v mongodb_data:/data/db `
  mongo:latest
```

Or using `docker-compose` (create `docker-compose.yml`):

```yaml
version: "3.8"
services:
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: password
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

Then run:

```powershell
docker-compose up -d
```

Note: If another container already binds host port `8000` (for example `open-notebook-surrealdb-1`), your FastAPI backend cannot bind the same port. Stop or remap that container before running backend on `:8000`.

**Default connection string** (if not using auth):

```
mongodb://localhost:27017/quasar
```

**With auth:**

```
mongodb://root:password@localhost:27017/quasar
```

Set `MONGO_URI` in `.env` to match your setup.

## Documentation

- API summary: `docs/API_REFERENCE.md`

That is the complete maintained doc set.
