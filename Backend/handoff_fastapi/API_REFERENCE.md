# API Reference

Mounted prefix defaults to `/rag`.

## Health

- GET `/rag/health`

## Notebooks

- POST `/rag/notebooks`
- GET `/rag/notebooks`
- GET `/rag/notebooks/{notebook_id}`
- DELETE `/rag/notebooks/{notebook_id}`

## Notebook source links

- POST `/rag/notebooks/{notebook_id}/sources`
- DELETE `/rag/notebooks/{notebook_id}/sources/{source_id}`

## Notes

- GET `/rag/notebooks/{notebook_id}/notes`
- POST `/rag/notebooks/{notebook_id}/notes`
- PATCH `/rag/notes/{note_id}`
- DELETE `/rag/notes/{note_id}`

## Audio overview

- POST `/rag/notebooks/{notebook_id}/audio-overview`
- GET `/rag/notebooks/{notebook_id}/audio-overview`

## Podcasts

- POST `/rag/podcasts/generate`
- GET `/rag/podcasts/jobs/{job_id}`

## Prompts

- GET `/rag/prompts`
- GET `/rag/prompts/{name}`
- PUT `/rag/prompts/{name}`
- POST `/rag/prompts/bootstrap-defaults`

## Sources

- POST `/rag/sources/text`
- POST `/rag/sources/text/async`
- POST `/rag/sources/url`
- POST `/rag/sources/url/async`
- POST `/rag/sources/file`
- POST `/rag/sources/file/async`
- GET `/rag/sources`
- GET `/rag/sources/{source_id}`
- DELETE `/rag/sources/{source_id}`

## Vector DB

- POST `/rag/vector-db/init`
- GET `/rag/vector-db/stats`
- POST `/rag/vector-db/rebuild`
- POST `/rag/vector-db/rebuild/async`

## Search

- POST `/rag/search`

## Chat

- POST `/rag/chat/sessions`
- GET `/rag/chat/sessions`
- GET `/rag/chat/sessions/{session_id}`
- POST `/rag/chat/sessions/{session_id}/messages`

## Models

- GET `/rag/models`

## Jobs

- GET `/rag/jobs`
- GET `/rag/jobs/{job_id}`

## Speech

- POST `/rag/speech/transcribe`
- POST `/rag/speech/synthesize`

Speech provider behavior:

- STT provider is controlled by `STT_PROVIDER` (`auto`, `whisper`, `deepgram`).
- `auto` tries `faster-whisper` first, then Deepgram when `DEEPGRAM_API_KEY` is configured.
- TTS uses `gTTS`.

# Portable RAG Export API Reference

This document describes the API exported by `Backend/handoff_fastapi` when mounted into a host FastAPI app.

Source of truth:

- `portable_rag_backend/api/router.py`
- `portable_rag_backend/schemas.py`

## Base URL and Conventions

- Default mount prefix: `/rag` (configurable in your host app).
- Most endpoints use `application/json`.
- File upload endpoints use `multipart/form-data`.
- Async endpoints return `202 Accepted` with a `JobSubmissionResponse`; poll `/rag/jobs/{job_id}` for completion.
- Errors are standard FastAPI HTTP errors, typically:

```json
{
  "detail": "error message"
}
```

## Endpoint Matrix

| Group                   | Method | Path                                               | Body schema                                                       | Response schema             | Status        |
| ----------------------- | ------ | -------------------------------------------------- | ----------------------------------------------------------------- | --------------------------- | ------------- |
| Health                  | GET    | `/rag/health`                                      | None                                                              | `HealthResponse`            | 200           |
| Notebooks               | POST   | `/rag/notebooks`                                   | `NotebookCreateRequest`                                           | `NotebookResponse`          | 200           |
| Notebooks               | GET    | `/rag/notebooks`                                   | None                                                              | `NotebookResponse[]`        | 200           |
| Notebooks               | GET    | `/rag/notebooks/{notebook_id}`                     | None                                                              | `NotebookDetailResponse`    | 200, 404      |
| Notebooks               | DELETE | `/rag/notebooks/{notebook_id}`                     | None                                                              | `NotebookDeleteResponse`    | 200, 400      |
| Notebook-source linking | POST   | `/rag/notebooks/{notebook_id}/sources`             | `SourceLinkRequest`                                               | `SourceLinkResponse`        | 200, 400      |
| Notebook-source linking | DELETE | `/rag/notebooks/{notebook_id}/sources/{source_id}` | None                                                              | `SourceLinkResponse`        | 200, 404, 400 |
| Notes                   | GET    | `/rag/notebooks/{notebook_id}/notes`               | None                                                              | `NoteResponse[]`            | 200, 400      |
| Notes                   | POST   | `/rag/notebooks/{notebook_id}/notes`               | `NoteCreateRequest`                                               | `NoteResponse`              | 200, 400      |
| Notes                   | PATCH  | `/rag/notes/{note_id}`                             | `NoteUpdateRequest`                                               | `NoteResponse`              | 200, 404, 400 |
| Notes                   | DELETE | `/rag/notes/{note_id}`                             | None                                                              | `NoteDeleteResponse`        | 200, 404, 400 |
| Audio overview          | POST   | `/rag/notebooks/{notebook_id}/audio-overview`      | `AudioOverviewRequest`                                            | `JobSubmissionResponse`     | 202, 400      |
| Audio overview          | GET    | `/rag/notebooks/{notebook_id}/audio-overview`      | None                                                              | `AudioOverviewResponse`     | 200, 404, 400 |
| Podcasts                | POST   | `/rag/podcasts/generate`                           | `PodcastGenerationRequest`                                        | `PodcastGenerationResponse` | 202, 400, 502 |
| Podcasts                | GET    | `/rag/podcasts/jobs/{job_id}`                      | None                                                              | `JobStatusResponse`         | 200, 404, 502 |
| Prompt templates        | GET    | `/rag/prompts`                                     | None                                                              | `PromptTemplateResponse[]`  | 200           |
| Prompt templates        | GET    | `/rag/prompts/{name}`                              | None                                                              | `PromptTemplateResponse`    | 200, 404      |
| Prompt templates        | PUT    | `/rag/prompts/{name}`                              | `PromptTemplateUpdateRequest`                                     | `PromptTemplateResponse`    | 200           |
| Prompt templates        | POST   | `/rag/prompts/bootstrap-defaults`                  | None                                                              | `PromptBootstrapResponse`   | 200           |
| Resource stats          | GET    | `/rag/resources/stats`                             | None                                                              | `ResourceStatsResponse`     | 200           |
| Sources                 | POST   | `/rag/sources/text`                                | `SourceTextCreateRequest`                                         | `SourceResponse`            | 200, 400      |
| Sources                 | POST   | `/rag/sources/text/async`                          | `SourceTextCreateRequest`                                         | `JobSubmissionResponse`     | 202, 400      |
| Sources                 | POST   | `/rag/sources/url`                                 | `SourceUrlCreateRequest`                                          | `SourceResponse`            | 200, 400      |
| Sources                 | POST   | `/rag/sources/url/async`                           | `SourceUrlCreateRequest`                                          | `JobSubmissionResponse`     | 202, 400      |
| Sources                 | POST   | `/rag/sources/file`                                | `multipart/form-data` (`notebook_id`, `title?`, `embed?`, `file`) | `SourceResponse`            | 200, 400, 413 |
| Sources                 | POST   | `/rag/sources/file/async`                          | `multipart/form-data` (`notebook_id`, `title?`, `embed?`, `file`) | `JobSubmissionResponse`     | 202, 400, 413 |
| Sources                 | GET    | `/rag/sources`                                     | None (optional query `notebook_id`)                               | `SourceListResponse[]`      | 200           |
| Sources                 | GET    | `/rag/sources/{source_id}`                         | None                                                              | `SourceResponse`            | 200, 404      |
| Sources                 | DELETE | `/rag/sources/{source_id}`                         | None                                                              | `SourceDeleteResponse`      | 200, 400      |
| Vector DB               | POST   | `/rag/vector-db/init`                              | None                                                              | `VectorDbInitResponse`      | 200           |
| Vector DB               | GET    | `/rag/vector-db/stats`                             | None                                                              | `VectorDbInitResponse`      | 200           |
| Vector DB               | POST   | `/rag/vector-db/rebuild`                           | `VectorRebuildRequest`                                            | `VectorRebuildResponse`     | 200, 400      |
| Vector DB               | POST   | `/rag/vector-db/rebuild/async`                     | `VectorRebuildRequest`                                            | `JobSubmissionResponse`     | 202, 400      |
| Search                  | POST   | `/rag/search`                                      | `SearchRequest`                                                   | `SearchResponse`            | 200, 400      |
| Chat                    | POST   | `/rag/chat/sessions`                               | `CreateChatSessionRequest`                                        | `ChatSessionResponse`       | 200, 400      |
| Chat                    | GET    | `/rag/chat/sessions`                               | None (required query `notebook_id`)                               | `ChatSessionResponse[]`     | 200           |
| Chat                    | GET    | `/rag/chat/sessions/{session_id}`                  | None                                                              | `ChatSessionDetailResponse` | 200, 404      |
| Chat                    | POST   | `/rag/chat/sessions/{session_id}/messages`         | `ChatMessageRequest`                                              | `ChatMessageResponse`       | 200, 400      |
| Models                  | GET    | `/rag/models`                                      | None                                                              | `ModelInfoResponse`         | 200           |
| Jobs                    | GET    | `/rag/jobs`                                        | None (query `limit?`, `offset?`)                                  | `JobStatusResponse[]`       | 200           |
| Jobs                    | GET    | `/rag/jobs/{job_id}`                               | None                                                              | `JobStatusResponse`         | 200, 404      |
| Speech                  | POST   | `/rag/speech/transcribe`                           | `multipart/form-data` (`file`)                                    | `TranscribeResponse`        | 200, 400      |
| Speech                  | POST   | `/rag/speech/synthesize`                           | `SynthesizeRequest`                                               | `audio/mpeg` file stream    | 200, 400      |

## Query Parameters

- `GET /rag/sources`
  - `notebook_id` (optional `string`): filter sources by notebook.
- `GET /rag/chat/sessions`
  - `notebook_id` (required `string`): list sessions for a notebook.
- `GET /rag/jobs`
  - `limit` (optional `int`, default `20`, range `1..100`)
  - `offset` (optional `int`, default `0`, minimum `0`)

## Request Schema Quick Reference

- `NotebookCreateRequest`
  - `name: string` (required, 1..120)
  - `description: string` (optional, default `""`, max 2000)

- `SourceLinkRequest`
  - `source_id: string` (required)

- `NoteCreateRequest`
  - `content: string` (required, min 1)
  - `source_id: string | null` (optional)
  - `source_ids: string[] | null` (optional)

- `NoteUpdateRequest`
  - `content: string` (required, min 1)

- `AudioOverviewRequest`
  - `briefing: string | null` (optional)
  - `provider: "local" | "gemini" | "lmstudio" | null` (optional)
  - `model: string | null` (optional)
  - `temperature: float` (optional, default `0.3`, range `0.0..1.0`)

- `PodcastGenerationRequest`
  - `episode_profile: string` (required)
  - `speaker_profile: string` (required)
  - `episode_name: string` (required)
  - `notebook_id: string | null` (optional)
  - `content: string | null` (optional)
  - `briefing_suffix: string | null` (optional)

- `PromptTemplateUpdateRequest`
  - `content: string` (required, min 1)

- `SourceTextCreateRequest`
  - `notebook_id: string` (required)
  - `content: string` (required, min 1)
  - `title: string | null` (optional)
  - `embed: bool` (optional, default `true`)

- `SourceUrlCreateRequest`
  - `notebook_id: string` (required)
  - `url: string` (required)
  - `title: string | null` (optional)
  - `embed: bool` (optional, default `true`)

- `VectorRebuildRequest`
  - `notebook_id: string | null` (optional)
  - `source_ids: string[] | null` (optional)

- `SearchRequest`
  - `notebook_id: string` (required)
  - `query: string` (required, min 1)
  - `k: int` (optional, default `6`, range `1..30`)
  - `source_ids: string[] | null` (optional filter)

- `CreateChatSessionRequest`
  - `notebook_id: string` (required)
  - `title: string | null` (optional)
  - `provider: "local" | "gemini" | "lmstudio" | null` (optional)
  - `model: string | null` (optional)

- `ChatMessageRequest`
  - `message: string` (required, min 1)
  - `provider: "local" | "gemini" | "lmstudio" | null` (optional)
  - `model: string | null` (optional)
  - `retrieval_k: int | null` (optional, range `1..30`)
  - `temperature: float` (optional, default `0.2`, range `0.0..1.0`)
  - `source_ids: string[] | null` (optional source filter)

- `SynthesizeRequest`
  - `text: string` (required, min 1)
  - `language: string | null` (optional)

## Response Schema Quick Reference

- `HealthResponse`
  - `ok: bool`
  - `storage: { sqlite: string, vector: string }`

- `NotebookResponse`
  - `id, name, description, created_at, updated_at`

- `NotebookDetailResponse`
  - `id, name, description, source_ids[], created_at, updated_at`

- `NotebookDeleteResponse`
  - `success, notebook_id, unlinked_sources, deleted_notes`

- `SourceLinkResponse`
  - `notebook_id, source_id, linked`

- `NoteResponse`
  - `id, notebook_id, content, source_id?, source_ids[], created_at, updated_at`

- `NoteDeleteResponse`
  - `success, note_id`

- `PromptTemplateResponse`
  - `name, content, updated_at`

- `PromptBootstrapResponse`
  - `upserted, names[]`

- `ResourceStatsResponse`
  - `notebooks_count, sources_count, chat_sessions_count, chat_messages_count, notes_count, audio_overviews_count, jobs_count, db_size_bytes, vector_documents_count`

- `SourceResponse`
  - `id, notebook_id, source_type, title, origin?, content, chunk_count, created_at, updated_at`

- `SourceListResponse`
  - `id, notebook_id, source_type, title, origin?, chunk_count, created_at, updated_at`

- `SourceDeleteResponse`
  - `success, source_id, vectors_deleted`

- `VectorDbInitResponse`
  - `initialized, collection_name, vector_documents_count, persist_directory`

- `VectorRebuildResponse`
  - `rebuilt_sources, skipped_sources, vector_documents_count`

- `SearchResponse`
  - `results: object[]`

- `ChatSessionResponse`
  - `id, notebook_id, title, provider, model, created_at, updated_at`

- `ChatSessionDetailResponse`
  - `session: ChatSessionResponse`
  - `messages: object[]`

- `ChatMessageResponse`
  - `session_id`
  - `answer`
  - `citation_map: CitationEvidence[]`

- `CitationEvidence`
  - `index, source_id, title?, chunk_id?, chunk_index?, score, snippet, content, line_start?, line_end?, start_char?, end_char?`

- `ModelInfoResponse`
  - `default_chat_provider`
  - `default_embedding_provider`
  - `local: object`
  - `lmstudio: object`
  - `gemini: object`
  - `speech: object`

- `JobSubmissionResponse`
  - `job_id, job_type, status, created_at`

- `JobStatusResponse`
  - `id, job_type, status, payload, result?, error?, created_at, updated_at, started_at?, completed_at?`

- `PodcastGenerationResponse`
  - `job_id, status, message, episode_profile, episode_name`

- `TranscribeResponse`
  - `text`

## Podcast Integration Behavior

- `POST /rag/podcasts/generate`
  - If `REMOTE_API_BASE_URL` is configured, request forwarding is attempted to:
    - `{REMOTE_API_BASE_URL}/podcasts/generate`
    - `{REMOTE_API_BASE_URL}/api/podcasts/generate` (fallback path)
  - If remote forwarding is not configured, portable backend enqueues a local `audio_overview_generation` job.
  - Local mode accepts either:
    - `notebook_id` (uses linked notebook sources), or
    - `content` (direct inline context, no notebook required).

- `GET /rag/podcasts/jobs/{job_id}`
  - If `REMOTE_API_BASE_URL` is configured, status forwarding is attempted to the same two base-path variants.
  - If remote forwarding is not configured, status is resolved from local portable jobs.

## Async Workflow Notes

Async endpoints return a `JobSubmissionResponse` immediately, then execute in the background. Typical flow:

1. Call an async endpoint.
2. Read `job_id` from the response.
3. Poll `GET /rag/jobs/{job_id}` until status is `completed` or `failed`.
4. If needed, fetch the related resource endpoint (for example, `/rag/notebooks/{notebook_id}/audio-overview`).

## OpenAPI

After mounting, the host app OpenAPI schema includes these routes. Check:

- `/docs` for Swagger UI
- `/openapi.json` for machine-readable schema
