# Quasar EduSaarthi: System Architecture, Process Flow, and Feature Assessment

## 1. Executive Summary

This project is a full-stack adaptive learning platform with:

- A React frontend (Vite) for onboarding, assessments, recommendations, dashboard analytics, and progress tracking.
- A FastAPI backend exposing modular route groups for authentication, onboarding, quiz generation/scoring, recommendation engines, YouTube Q&A, deep research, gamification, analytics, and user milestones.
- MongoDB as the primary data store.
- A hybrid AI strategy: local LM Studio first, with cloud fallback support and deterministic fallbacks when LLM services are unavailable.

The architecture is practical and feature-rich for an AI-assisted learning product. The main strengths are modular API routing, dependency-health awareness, and graceful degradation paths. The key maturity gaps are production-grade security hardening and long-lived cache/session strategy.

## 2. System Architecture Assessment

### 2.1 High-Level Architecture

1. Frontend Layer:

- React SPA with route-based flows for login, onboarding, assessment, recommendations, YouTube assessment, deep research, and dashboard.
- API abstraction through a centralized client with token handling and structured error normalization.

2. Backend Layer:

- FastAPI app with route modules grouped by domain:
- Auth, onboarding, assessment, YouTube recommendations, YouTube quiz, YouTube Q&A (RAG), deep research, gamification, analytics, user milestones.
- Common service modules for LLM adapter, health checks, RAG utilities, search utilities, and quiz generation.

3. Data Layer:

- MongoDB collections store users, profiles, onboarding artifacts, assessments, activities, badges/XP, milestones, and generated recommendation caches.

4. AI/LLM Layer:

- Primary local inference endpoint (LM Studio).
- Cloud fallback provider support (currently configured for Google fallback).
- Deterministic non-LLM fallback for several user-facing paths to prevent hard failures.

### 2.2 Logical Components

1. API Gateway Role (FastAPI app):

- Route registration and global exception handling.
- Dependency health endpoints and status reporting.

2. Domain Services:

- Auth and profile service.
- Assessment service.
- Learning recommendation service.
- YouTube content intelligence service.
- Deep research service.
- Gamification and analytics service.

3. Reliability Components:

- Dependency probe service for MongoDB, LLM runtime, and external API readiness.
- Structured error payloads for frontend-friendly messaging.
- Fallback handling in quiz/recommendation generation.

### 2.3 Data Persistence and Cache Strategy

1. Persistent User/Progress Data:

- Stored in MongoDB (assessment history, milestones, XP/badges, login activity, onboarding data).

2. Generated Content Caches:

- YouTube playlists are cached per user and assessment signature.
- Deep research recommendations are cached per user and assessment signature.
- This design avoids regenerating recommendations when progress has not changed.

3. In-Memory Runtime Caches:

- Quiz caches are in-memory for some flows.
- Suitable for local/single-instance development, but not durable across restarts.

### 2.4 Technology Stack Assessment

1. Frontend:

- React, React Router, React Query, Tailwind, Charting libraries.
- Good for dynamic dashboard and multi-step guided UX.

2. Backend:

- FastAPI, Pydantic, JWT auth, PyMongo.
- Clean modular route design and straightforward extension model.

3. AI and Retrieval:

- Local-first LLM adapter with cloud fallback.
- Transcript retrieval and RAG-style QA over YouTube content.

## 3. End-to-End Process Flows

### 3.1 User Authentication and Session Flow

1. User registers with email/password.
2. Password is hashed and stored.
3. Login returns JWT token.
4. Frontend stores token and calls user-status endpoint.
5. Route guards redirect users to onboarding, assessment, or dashboard based on backend-trusted completion flags.

### 3.2 Onboarding Flow

1. User completes a 3-step onboarding journey.
2. Backend writes preferences/goals/profile/skills to MongoDB.
3. User record is marked onboarding_complete.
4. Frontend transitions to assessment.

### 3.3 Skill Assessment Flow

1. Frontend requests quiz generation with user context.
2. Backend generates questions via LLM adapter.
3. If LLM fails, fallback questions are returned.
4. User submits answers.
5. Backend scores and produces skill-gap analysis and recommendations.
6. Assessment result is persisted and assessment_complete is updated.

### 3.4 Recommendation Flow (Cost-Optimized)

1. Frontend requests YouTube recommendations or deep research recommendations.
2. Backend computes assessment signature from current user progress snapshot.
3. Backend checks cache collections keyed by user_id + assessment_signature.
4. If cache hit, return stored recommendations immediately.
5. If cache miss, generate results and persist for future reuse.

### 3.5 YouTube Q&A (RAG) Flow

1. Frontend processes video URL.
2. Backend extracts transcript and builds retriever context.
3. User asks question.
4. Backend returns answer with timeline/source chunks.
5. If AI generation fails, transcript-only fallback response is returned where available.

### 3.6 YouTube Quiz Flow

1. Frontend submits a YouTube URL.
2. Backend gets transcript and generates quiz.
3. User submits answers.
4. Backend scores and returns detailed feedback.

### 3.7 Dashboard and Analytics Flow

1. Frontend fetches profile, assessment history, login activity, XP, badges, and analytics dashboard.
2. Backend aggregates streaks, progress, milestones, and achievement data from multiple collections.
3. Dashboard presents learning telemetry and next actions.

## 4. Feature Inventory

### 4.1 Core User Features

1. User registration and login.
2. Authenticated session with JWT.
3. User profile retrieval.
4. Onboarding completion and status tracking.

### 4.2 Learning and Assessment Features

1. Personalized skill assessment quiz generation.
2. Quiz submission and scoring.
3. Skill-gap and recommendation output.
4. Assessment history and statistics.

### 4.3 YouTube Learning Features

1. YouTube learning recommendations based on assessment.
2. Video-specific quiz generation and submission.
3. YouTube transcript extraction.
4. YouTube Q&A with source timestamps.
5. Comprehensive video info extraction (topics/summary).

### 4.4 Research and Discovery Features

1. Deep research recommendations from external search providers.
2. Resource categorization (article/course/youtube/project/docs/blog).
3. Cached deep research results for cost control.

### 4.5 Motivation and Progress Features

1. XP and level progression.
2. Badge collection and recent achievements.
3. Learning streak computation.
4. User milestones CRUD.
5. Analytics dashboard with weekly activity and progress metrics.

### 4.6 Reliability and Operations Features

1. Dependency health endpoints.
2. Structured backend error responses.
3. Local-first LLM strategy with cloud fallback support.
4. Deterministic fallback content generation to avoid user-facing 500s.

## 5. Current Strengths

1. Clear modular backend route decomposition by domain.
2. Practical full learning lifecycle from onboarding to analytics.
3. Stronger resilience posture with fallback patterns and health visibility.
4. Cost-optimization now in place for recommendation regeneration.
5. Frontend route guards align UX with backend-trusted completion state.

## 6. Risks and Improvement Priorities

### 6.1 High Priority

1. Security hardening:

- Replace plain SHA-256 password hashing with salted adaptive hashing (bcrypt/argon2).
- Restrict CORS allow_origins from wildcard in production.

2. Runtime consistency:

- Standardize environment loading and startup scripts to avoid stale env values.

### 6.2 Medium Priority

1. Durable cache/session architecture:

- Move in-memory quiz caches to persistent store (Redis/Mongo) for multi-instance reliability.

2. Observability:

- Add structured logging and request correlation IDs for all major flows.

3. Contract consistency:

- Normalize response shapes across all route families (status, cached, dependency metadata).

### 6.3 Low Priority

1. Add explicit versioning for APIs.
2. Add retention and TTL strategies for generated cache collections.
3. Expand automated integration tests for fallback-path verification.

## 7. Assessment Conclusion

The project architecture is solid for an AI-powered adaptive learning platform and now includes practical mechanisms to control recommendation cost through progress-aware caching. The process flow coverage is broad and coherent across frontend and backend. With targeted security and operational hardening, this system can move from strong prototype quality toward production-grade reliability.
