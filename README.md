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

Frontend API base URL (optional):

- `VITE_API_URL` (default `http://localhost:8000`)

## Core Paths

- Backend entrypoint: `Backend/main.py`
- Frontend API config: `frontend/src/config/api.js`
- Primary route modules: `Backend/routes/`

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
