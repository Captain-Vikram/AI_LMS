# API Reference

Base URL (local): `http://localhost:8000`

Interactive OpenAPI docs:

- `GET /docs`
- `GET /redoc`

## ⚡ Async Architecture

The backend is async-first and supports concurrent request handling. The current stack uses:

- **FastAPI** with async/await for request handling
- **Motor** for non-blocking MongoDB operations in primary async paths
- Compatibility adapters for a few legacy sync service paths (no API contract change)
- **httpx** for async HTTP client operations (for LLM calls and external APIs)
- **asyncio** for parallel operations within single requests

This means:

- Multiple API calls can be processed simultaneously
- Most database and external API calls happen in parallel, not sequentially
- Legacy sync logic is isolated behind route/service adapters during migration
- Higher throughput and lower latency under concurrent load

**Performance**: Concurrent workloads generally perform better than strictly sequential request flows.

## Health

- `GET /`
- `GET /health`
- `GET /health/dependencies`

## Auth

Prefix: `/api/auth`

- `POST /register`
- `POST /login`
- `GET /user-profile`
- `GET /user-status`
- `POST /set-active-classroom/{classroom_id}` (returns refreshed JWT with `active_classroom` and updated classroom role claims)
- `POST /update-onboarding-status`
- `POST /update-assessment-status`
- `GET /login-activity`

## Onboarding

Prefix: `/api/onboarding`

- `GET /status`
- `POST /teacher/setup`
- `POST /student/join`
- `GET /teacher/pathway/{classroom_id}` (accessible by classroom teacher/co-teacher and admins)

## Classroom Core

Prefix: `/api/classroom`

- `GET /` (list classrooms)
- `POST /create`
- `GET /{classroom_id}`
- `PUT /{classroom_id}`
- `GET /find`
- `POST /{classroom_id}/join`
- `GET /my/enrollments`
- `POST /bootstrap/demo`

### Resources

- `GET /{classroom_id}/resources`
- `PATCH /{classroom_id}/resources/{resource_id}/approval`

### Activity and Grading Signals

- `GET /{classroom_id}/activity-feed`
- `GET /{classroom_id}/pending-grading-count`

### Enrollment and Groups

- `POST /{classroom_id}/enroll`
- `POST /{classroom_id}/members/add`
- `POST /{classroom_id}/members/bulk-upload`
- `GET /{classroom_id}/members`
- `DELETE /{classroom_id}/members/{student_id}`
- `POST /{classroom_id}/groups`
- `POST /{classroom_id}/groups/{group_id}/members`

Validation update:

- Malformed ObjectId inputs now return `400 Bad Request` (instead of `500 Internal Server Error`) for enrollment/group member mutation endpoints.

### Dashboard

- `GET /{classroom_id}/dashboard`
- `GET /{classroom_id}/overview`

### Announcements

- `POST /{classroom_id}/announcements`
- `GET /{classroom_id}/announcements`
- `POST /{classroom_id}/announcements/{announcement_id}/view`
- `PUT /{classroom_id}/announcements/{announcement_id}`
- `DELETE /{classroom_id}/announcements/{announcement_id}`

### Learning Modules

- `POST /{classroom_id}/modules/generate`
- `GET /{classroom_id}/modules`
- `POST /{classroom_id}/modules`
- `PATCH /{classroom_id}/modules/reorder`
- `GET /{classroom_id}/modules/approved-resources`
- `POST /{classroom_id}/modules/{module_id}/resources/assign`
- `GET /{classroom_id}/modules/{module_id}`
- `GET /{classroom_id}/modules/{module_id}/progress`
- `POST /{classroom_id}/modules/{module_id}/resources/{resource_id}/engagement`
- `GET /{classroom_id}/modules/{module_id}/analytics`

Stability update (2026-04-18):

- Module generation/list/progress/analytics endpoint flows were revalidated and now return expected `2xx/4xx` responses with no observed `5xx` during full API sweep.

## Student Progress

Prefix: `/api/student`

- `GET /progress/{module_id}`
- `GET /progress/resources/unlocked`

## Module Assessment

Prefix: `/api/module-assessment`

- `POST /draft-generate`
- `GET /module/{module_id}/latest`
- `GET /{assessment_id}`
- `PATCH /{assessment_id}`
- `POST /{assessment_id}/publish`
- `POST /submission/start`
- `POST /submission/{submission_id}/submit`
- `GET /submission/{submission_id}`
- `PATCH /submission/{submission_id}/grade`
- `GET /pending-grades/{classroom_id}`

## Analytics

Prefix: `/api/analytics`

- `GET /dashboard`
- `GET /classroom/{classroom_id}`
- `GET /classroom/{classroom_id}/student/{student_id}`
- `GET /classroom/{classroom_id}/my-progress`
- `GET /classroom/{classroom_id}/ai-questions-by-module` (optional `student_id` query for student-scoped heatmap)

## Quiz and Learning Intelligence

### Skill Quiz

Prefix: `/api/quiz`

- `POST /generate`
- `POST /submit`
- `GET /assessment-history`
- `GET /statistics`

### YouTube Recommendations

Prefix: `/api/youtube`

- `POST /recommendations`
- `POST /get_videos`
- `GET /search`

### Resource Q&A (RAG)

Prefix: `/api/resource`

- `GET /summary/get-or-create`
- `POST /qa/ask`
- `POST /ask`
- `GET /chat-history/{resource_id}/{student_id}`

### YouTube Quiz

Prefix: `/api/youtube-quiz`

- `POST /generate`
- `POST /submit`

### Studio Orchestration

Prefix: `/api/studio`

- `POST /generate` (unifies summary and quiz workflows)
- `POST /summary` (legacy/direct summary access)
- `POST /quiz` (legacy/direct quiz access)

### Deep Research & Recommendations

Prefix: `/api/deepresearch`

- `POST /recommendations` (generate skill resources)

## Skill Pathways

Prefix: `/api/pathways`

- `GET /available` (list all available standalone pathways)
- `GET /{pathway_id}` (get full blueprint of a specific pathway)
- `POST /{pathway_id}/enroll` (enroll current user in a pathway)
- `GET /progress/my-pathways` (get progress dashboard for all enrolled pathways)
- `GET /progress/{pathway_id}` (get detailed progress for a specific pathway)
- `GET /{pathway_id}/stage/{stage_index}` (fetch specific stage progress and topics)
- `POST /{pathway_id}/stage/{stage_index}/complete` (manually mark a stage as completed)
- `GET /{pathway_id}/stage/{stage_index}/resource/{resource_id}/tests` (generate tests for a resource)
- `POST /{pathway_id}/stage/{stage_index}/generate-resources` (trigger AI generation of stage resources)
- `POST /{pathway_id}/stage/{stage_index}/submit-test` (submit test results and auto-advance)

## Module Assessment Workflow (Multi-Mode)

Prefix: `/api/module-assessment/workflow`

### Authoring

- `POST /draft-generate` (generate initial multi-mode assessment draft)
- `POST /generate-topics` (refresh AI topics/scenarios for a specific category)
- `GET /module/{module_id}/latest` (get latest workflow for a module)
- `GET /{workflow_id}` (get full workflow details)
- `PATCH /{workflow_id}` (update workflow settings, categories, and topics)
- `POST /{workflow_id}/finalize` (finalize and publish the assessment)
- `POST /{workflow_id}/latex-template` (upload .tex template for research mode)
- `GET /{workflow_id}/latex-template/download` (download the .tex template)

### Submission

- `POST /submission/start` (student begins the workflow assessment)
- `POST /submission/{submission_id}/submit-scenario` (submit long-answer scenario responses)
- `POST /submission/{submission_id}/submit-article-link` (submit public URL for article/blog mode)
- `POST /submission/{submission_id}/submit-artifact` (upload PDF or LaTeX artifact)
- `GET /submission/{submission_id}` (get submission details and grading status)
- `GET /submission/{submission_id}/download` (download student artifact)

### Moderation

- `GET /pending-grades/{classroom_id}` (list submissions awaiting teacher review)
- `PATCH /submission/{submission_id}/teacher-review` (submit final teacher points and comments)

## Portable RAG Backend

Prefix: `/api/portable-rag`

### Service and Models

- `GET /health`
- `GET /models`

### Notebooks

- `POST /notebooks`
- `GET /notebooks`
- `GET /notebooks/{notebook_id}`
- `DELETE /notebooks/{notebook_id}`
- `POST /notebooks/{notebook_id}/sources`
- `DELETE /notebooks/{notebook_id}/sources/{source_id}`
- `GET /notebooks/{notebook_id}/audio-overview`
- `POST /notebooks/{notebook_id}/audio-overview`

### Notes

- `GET /notebooks/{notebook_id}/notes`
- `POST /notebooks/{notebook_id}/notes`
- `PATCH /notes/{note_id}`
- `DELETE /notes/{note_id}`

### Prompt Templates

- `GET /prompts`
- `GET /prompts/{name}`
- `PUT /prompts/{name}`
- `POST /prompts/bootstrap-defaults`

### Sources and Ingestion

- `GET /resources/stats`
- `POST /sources/text`
- `POST /sources/text/async`
- `POST /sources/url`
- `POST /sources/url/async`
- `POST /sources/file`
- `POST /sources/file/async`
- `GET /sources`
- `GET /sources/{source_id}`
- `DELETE /sources/{source_id}`

### Vector DB and Search

- `POST /vector-db/init`
- `GET /vector-db/stats`
- `POST /vector-db/rebuild`
- `POST /vector-db/rebuild/async`
- `POST /search`

### Chat Sessions

- `POST /chat/sessions`
- `GET /chat/sessions`
- `GET /chat/sessions/{session_id}`
- `POST /chat/sessions/{session_id}/messages`

### Jobs and Speech

- `GET /jobs`
- `GET /jobs/{job_id}`
- `POST /speech/transcribe`
- `POST /speech/synthesize`

Speech behavior notes:

- `POST /api/portable-rag/speech/transcribe` uses `STT_PROVIDER`:
  - `whisper`: local `faster-whisper` only.
  - `deepgram`: Deepgram only.
  - `auto`: Whisper first, then Deepgram fallback when configured.
- `POST /api/portable-rag/speech/synthesize` uses `gTTS`.

## Gamification and User

### Gamification

Prefix: `/api/gamification`

- `GET /xp`
- `POST /award-xp`
- `GET /badges`
- `GET /achievements/recent`

### User

Prefix: `/api/user`

- `GET /milestones`
- `POST /milestones`
- `PATCH /milestones/{milestone_id}`
- `DELETE /milestones/{milestone_id}`

## Notes

- Most non-auth endpoints require `Authorization: Bearer <token>`.
- For exact request/response schemas, use Swagger at `/docs`.
- All endpoints use async operations - responses may be faster than expected due to parallel request handling.
- The API supports concurrent requests - send multiple requests simultaneously for optimal performance.
- Database operations use Motor (async MongoDB driver) for non-blocking I/O.
- External API calls (LLM, YouTube, etc.) use httpx for async operations with automatic fallback support.
- Route inventory snapshot (2026-04-19): `127` `/api/*` operations currently registered in the FastAPI app.

## Async Capabilities

### Request Concurrency

You can make multiple API calls simultaneously without performance degradation:

```javascript
// Frontend - Make concurrent requests
const results = await Promise.all([
  fetch("/api/auth/user-profile", {
    headers: { Authorization: `Bearer ${token}` },
  }),
  fetch("/api/youtube/recommendations", {
    headers: { Authorization: `Bearer ${token}` },
  }),
  fetch("/api/quiz/assessment-history", {
    headers: { Authorization: `Bearer ${token}` },
  }),
]).then((responses) => Promise.all(responses.map((r) => r.json())));
```

### Parallel Operations Within Requests

Many endpoints perform parallel database queries and API calls, resulting in faster response times:

- `GET /api/auth/user-profile` - Fetches user and profile data in parallel
- `GET /api/classroom/{classroom_id}/dashboard` - Aggregates multiple analytics queries in parallel
- `POST /api/youtube/recommendations` - Generates playlists while caching in parallel

### External Service Integration

- **LLM Operations**: Uses async httpx for local LM Studio and cloud fallback providers (Groq, Google)
- **YouTube APIs**: Async transcript fetching and video search
- **Database**: All MongoDB queries use async Motor driver

## Troubleshooting

### Slow Responses

- Ensure MongoDB is running: Check `MONGO_URI` environment variable
- Check LLM Studio availability: Verify `LMSTUDIO_URL` is reachable
- Enable cloud fallback: Set `ENABLE_CLOUD_LLM_FALLBACK=true` for automatic fallback to Groq/Google

### Database Errors

- Error: `MongoDB unavailable` → Start Docker with `docker-compose up`
- Error: `Connection timeout` → Verify `MONGO_URI` in `.env` file
- Error: `Database not initialized` → Backend auto-initializes on startup; restart if needed

### Authentication Issues

- Ensure token is passed in `Authorization: Bearer <token>` header
- Token expires after configured duration - re-login if needed
- Check token validity: `GET /api/auth/user-status`

## Environment Variables

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/quasar

# LLM (Local)
LMSTUDIO_URL=http://127.0.0.1:1234
LMSTUDIO_MODEL=auto
LMSTUDIO_TIMEOUT_SECONDS=120

# LLM (Cloud Fallback)
ENABLE_CLOUD_LLM_FALLBACK=true
LLM_FALLBACK_PROVIDER=gemini  # legacy adapters may also use google/groq
LLM_FALLBACK_MODEL=gemini-1.5-flash
GOOGLE_API_KEY=your_key_here
GROQ_API_KEY=your_key_here

# Portable RAG providers
DEFAULT_CHAT_PROVIDER=lmstudio
DEFAULT_EMBEDDING_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
LMSTUDIO_CHAT_MODEL=auto
LMSTUDIO_EMBEDDING_MODEL=auto

# Speech (Portable RAG)
STT_PROVIDER=auto  # whisper | deepgram | auto
DEEPGRAM_API_KEY=
DEEPGRAM_STT_MODEL=nova-3
DEEPGRAM_BASE_URL=https://api.deepgram.com/v1
WHISPER_MODEL_SIZE=base
TTS_LANGUAGE=en

# JWT
SECRET_KEY=your_secret_key
JWT_ALGORITHM=HS256
```
