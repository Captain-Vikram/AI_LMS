# API Reference (Compact)

Base URL (local): `http://localhost:8000`

Interactive OpenAPI docs:

- `GET /docs`

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
- `POST /set-active-classroom/{classroom_id}`
- `POST /update-onboarding-status`
- `POST /update-assessment-status`
- `GET /login-activity`

## Onboarding

Prefix: `/api/onboarding`

- `POST /save`
- `GET /status`
- `GET /user-skills`
- `POST /teacher/setup`
- `POST /student/join`
- `GET /teacher/pathway/{classroom_id}`

## Classroom Core

Prefix: `/api/classroom`

- `GET /` (list classrooms)
- `POST /create`
- `GET /{classroom_id}`
- `GET /find`
- `POST /{classroom_id}/join`
- `GET /my/enrollments`
- `POST /bootstrap/demo`

### Resources

- `GET /{classroom_id}/resources`
- `PATCH /{classroom_id}/resources/{resource_id}/approval`

### Enrollment and Groups

- `POST /{classroom_id}/enroll`
- `POST /{classroom_id}/members/add`
- `POST /{classroom_id}/members/bulk-upload`
- `GET /{classroom_id}/members`
- `DELETE /{classroom_id}/members/{student_id}`
- `POST /{classroom_id}/groups`
- `POST /{classroom_id}/groups/{group_id}/members`

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

## Analytics

Prefix: `/api/analytics`

- `GET /dashboard`
- `GET /classroom/{classroom_id}`
- `GET /classroom/{classroom_id}/student/{student_id}`
- `GET /classroom/{classroom_id}/my-progress`

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

### YouTube Q&A (RAG)

Prefix: `/api/youtube-qa`

- `POST /process`
- `POST /ask`
- `GET /transcript/{video_id}`

### YouTube Quiz

Prefix: `/api/youtube-quiz`

- `POST /generate`
- `POST /submit`
- `GET /status/{quiz_id}`
- `POST /topics`
- `POST /comprehensive`

### Deep Research

Prefix: `/api/deepresearch`

- `POST /recommendations`

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
