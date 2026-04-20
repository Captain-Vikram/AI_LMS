Portable RAG — Podcast & Audio Generation

This module exposes lightweight podcast/audio features in the portable export.

Configuration

- Set `REMOTE_API_BASE_URL` (or `remote_api_base_url` in `PortableRAGSettings`) to forward requests to a running Open Notebook API (for example `http://localhost:5055/api`). If not set, the portable backend will run a local "audio overview" fallback.
- Forwarding tries both base variants automatically: with and without `/api` suffix.

Endpoints (mounted under your portable router prefix; default in handoff docs is `/rag`)

- POST /rag/podcasts/generate
  - Payload JSON:
    {
    "episode_profile": "<profile name>",
    "speaker_profile": "<speaker name>",
    "episode_name": "Episode Title",
    "notebook_id": "optional-notebook-id",
    "content": "optional raw content instead of notebook",
    "briefing_suffix": "optional briefing text"
    }
  - Behavior: If `REMOTE_API_BASE_URL` is set the request is forwarded to the remote API `/podcasts/generate`. Otherwise a local `audio_overview_generation` job is enqueued as a lightweight fallback.

- GET /rag/podcasts/jobs/{job_id}
  - Returns job status (queued/running/completed/failed) and result when available.

Quick curl examples

Forward to remote API (if configured):

curl -X POST "http://localhost:8000/rag/podcasts/generate" -H "Content-Type: application/json" -d '{"episode_profile":"default","speaker_profile":"default","episode_name":"Test Ep","notebook_id":"<id>"}'

Check job status:

curl "http://localhost:8000/rag/podcasts/jobs/<job_id>"

Notes

- The portable fallback generates an "audio overview" (short multi-turn script + TTS merge) using the local LLM/TTS providers configured for the portable backend. It is intentionally lightweight compared to the full `podcast-creator` pipeline available in the main API.
- To use the full podcast pipeline, configure `REMOTE_API_BASE_URL` to point at a running Open Notebook API (default port `5055`) that has episode/speaker profiles and background job processing available.
