from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class NotebookCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)


class NotebookResponse(BaseModel):
    id: str
    name: str
    description: str
    created_at: str
    updated_at: str


class NotebookDetailResponse(BaseModel):
    id: str
    name: str
    description: str
    source_ids: list[str]
    created_at: str
    updated_at: str


class NotebookDeleteResponse(BaseModel):
    success: bool
    notebook_id: str
    unlinked_sources: int
    deleted_notes: int


class SourceLinkRequest(BaseModel):
    source_id: str


class SourceLinkResponse(BaseModel):
    notebook_id: str
    source_id: str
    linked: bool


class SourceTextCreateRequest(BaseModel):
    notebook_id: str
    content: str = Field(..., min_length=1)
    title: str | None = None
    embed: bool = True


class SourceUrlCreateRequest(BaseModel):
    notebook_id: str
    url: str
    title: str | None = None
    embed: bool = True


class SourceResponse(BaseModel):
    id: str
    notebook_id: str
    source_type: str
    title: str
    origin: str | None = None
    content: str
    chunk_count: int
    created_at: str
    updated_at: str


class SourceListResponse(BaseModel):
    id: str
    notebook_id: str
    source_type: str
    title: str
    origin: str | None = None
    chunk_count: int
    created_at: str
    updated_at: str


class CreateChatSessionRequest(BaseModel):
    notebook_id: str
    title: str | None = None
    provider: Literal["local", "gemini", "lmstudio"] | None = None
    model: str | None = None


class ChatSessionResponse(BaseModel):
    id: str
    notebook_id: str
    title: str
    provider: str
    model: str
    created_at: str
    updated_at: str


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1)
    provider: Literal["local", "gemini", "lmstudio"] | None = None
    model: str | None = None
    retrieval_k: int | None = Field(default=None, ge=1, le=30)
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    source_ids: list[str] | None = Field(
        default=None,
        description="Optional list of selected source IDs to restrict retrieval.",
    )


class CitationEvidence(BaseModel):
    index: int
    source_id: str
    title: str | None = None
    chunk_id: str | None = None
    chunk_index: int | None = None
    score: float
    snippet: str
    content: str
    line_start: int | None = None
    line_end: int | None = None
    start_char: int | None = None
    end_char: int | None = None


class ChatMessageResponse(BaseModel):
    session_id: str
    answer: str
    citation_map: list[CitationEvidence]


class ChatSessionDetailResponse(BaseModel):
    session: ChatSessionResponse
    messages: list[dict[str, Any]]


class SearchRequest(BaseModel):
    notebook_id: str
    query: str = Field(..., min_length=1)
    k: int = Field(default=6, ge=1, le=30)
    source_ids: list[str] | None = Field(
        default=None,
        description="Optional source ID filter for retrieval.",
    )


class SearchResponse(BaseModel):
    results: list[dict[str, Any]]


class JobSubmissionResponse(BaseModel):
    job_id: str
    job_type: str
    status: Literal["queued", "running", "completed", "failed"]
    created_at: str


class JobStatusResponse(BaseModel):
    id: str
    job_type: str
    status: Literal["queued", "running", "completed", "failed"]
    payload: dict[str, Any]
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: str
    updated_at: str
    started_at: str | None = None
    completed_at: str | None = None


class PromptTemplateUpdateRequest(BaseModel):
    content: str = Field(..., min_length=1)


class PromptTemplateResponse(BaseModel):
    name: str
    content: str
    updated_at: str


class PromptBootstrapResponse(BaseModel):
    upserted: int
    names: list[str]


class NoteCreateRequest(BaseModel):
    content: str = Field(..., min_length=1)
    source_id: str | None = None
    source_ids: list[str] | None = None


class NoteUpdateRequest(BaseModel):
    content: str = Field(..., min_length=1)


class NoteResponse(BaseModel):
    id: str
    notebook_id: str
    content: str
    source_id: str | None = None
    source_ids: list[str]
    created_at: str
    updated_at: str


class NoteDeleteResponse(BaseModel):
    success: bool
    note_id: str


class AudioOverviewRequest(BaseModel):
    briefing: str | None = None
    provider: Literal["local", "gemini", "lmstudio"] | None = None
    model: str | None = None
    temperature: float = Field(default=0.3, ge=0.0, le=1.0)


class AudioOverviewResponse(BaseModel):
    notebook_id: str
    job_id: str
    status: str
    audio_path: str | None = None
    script: list[dict[str, str]] | None = None
    error: str | None = None
    updated_at: str


class PodcastGenerationRequest(BaseModel):
    episode_profile: str
    speaker_profile: str
    episode_name: str
    notebook_id: str | None = None
    content: str | None = None
    briefing_suffix: str | None = None


class PodcastGenerationResponse(BaseModel):
    job_id: str
    status: str
    message: str
    episode_profile: str
    episode_name: str


class ResourceStatsResponse(BaseModel):
    notebooks_count: int
    sources_count: int
    chat_sessions_count: int
    chat_messages_count: int
    notes_count: int
    audio_overviews_count: int
    jobs_count: int
    db_size_bytes: int
    vector_documents_count: int


class SourceDeleteResponse(BaseModel):
    success: bool
    source_id: str
    vectors_deleted: bool


class VectorDbInitResponse(BaseModel):
    initialized: bool
    collection_name: str
    vector_documents_count: int
    persist_directory: str


class VectorRebuildRequest(BaseModel):
    notebook_id: str | None = None
    source_ids: list[str] | None = None


class VectorRebuildResponse(BaseModel):
    rebuilt_sources: int
    skipped_sources: int
    vector_documents_count: int


class ModelInfoResponse(BaseModel):
    default_chat_provider: str
    default_embedding_provider: str
    local: dict[str, str]
    lmstudio: dict[str, str | bool]
    gemini: dict[str, str | bool]
    speech: dict[str, str | bool]


class TranscribeResponse(BaseModel):
    text: str


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1)
    language: str | None = None


class HealthResponse(BaseModel):
    ok: bool
    storage: dict[str, str]
