from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from portable_rag_backend.bootstrap import PortableRAGBackend
from portable_rag_backend.schemas import (
    AudioOverviewRequest,
    AudioOverviewResponse,
    PodcastGenerationRequest,
    PodcastGenerationResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSessionDetailResponse,
    ChatSessionResponse,
    CreateChatSessionRequest,
    HealthResponse,
    JobStatusResponse,
    JobSubmissionResponse,
    ModelInfoResponse,
    NoteCreateRequest,
    NoteDeleteResponse,
    NoteResponse,
    NoteUpdateRequest,
    NotebookCreateRequest,
    NotebookDeleteResponse,
    NotebookDetailResponse,
    NotebookResponse,
    PromptBootstrapResponse,
    PromptTemplateResponse,
    PromptTemplateUpdateRequest,
    ResourceStatsResponse,
    SearchRequest,
    SearchResponse,
    SourceDeleteResponse,
    SourceListResponse,
    SourceLinkRequest,
    SourceLinkResponse,
    SourceResponse,
    SourceTextCreateRequest,
    SourceUrlCreateRequest,
    SynthesizeRequest,
    TranscribeResponse,
    VectorDbInitResponse,
    VectorRebuildRequest,
    VectorRebuildResponse,
)


def build_router(backend: PortableRAGBackend) -> APIRouter:
    router = APIRouter()

    def _resolve_remote_urls(path_suffix: str) -> list[str]:
        base = (backend.settings.remote_api_base_url or "").strip().rstrip("/")
        if not base:
            return []

        urls = [f"{base}{path_suffix}"]
        if not base.endswith("/api"):
            urls.append(f"{base}/api{path_suffix}")

        deduped: list[str] = []
        seen: set[str] = set()
        for url in urls:
            if url not in seen:
                seen.add(url)
                deduped.append(url)
        return deduped

    def _normalize_job_status(status_value: str | None) -> str:
        status = (status_value or "running").strip().lower()
        if status in {"queued", "running", "completed", "failed"}:
            return status
        if status in {"pending", "submitted"}:
            return "queued"
        if status in {"done", "success", "succeeded"}:
            return "completed"
        if status in {"error", "errored"}:
            return "failed"
        return "running"

    def _to_job_status_response(job_id: str, raw: dict) -> JobStatusResponse:
        now_iso = datetime.now(timezone.utc).isoformat()

        payload = raw.get("payload")
        if not isinstance(payload, dict):
            payload = {}

        raw_result = raw.get("result")
        if raw_result is None:
            result = None
        elif isinstance(raw_result, dict):
            result = raw_result
        else:
            result = {"value": raw_result}

        error = raw.get("error")
        if error is not None and not isinstance(error, str):
            error = str(error)

        started_at = raw.get("started_at") or raw.get("startedAt")
        completed_at = raw.get("completed_at") or raw.get("completedAt")

        return JobStatusResponse(
            id=str(raw.get("id") or raw.get("job_id") or raw.get("jobId") or job_id),
            job_type=str(raw.get("job_type") or raw.get("type") or "podcast_generation"),
            status=_normalize_job_status(str(raw.get("status") or "running")),
            payload=payload,
            result=result,
            error=error,
            created_at=str(raw.get("created_at") or raw.get("createdAt") or now_iso),
            updated_at=str(raw.get("updated_at") or raw.get("updatedAt") or now_iso),
            started_at=str(started_at) if started_at else None,
            completed_at=str(completed_at) if completed_at else None,
        )

    @router.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        external_vector_url = backend.settings.resolve_vector_db_api_base_url()
        return HealthResponse(
            ok=True,
            storage={
                "sqlite": str(backend.settings.resolve_sqlite_path()),
                "vector": str(backend.settings.resolve_vector_dir()),
            },
            vector_db={
                "mode": "local_chroma",
                "external_configured": bool(external_vector_url),
                "external_base_url": external_vector_url or "",
            },
        )

    @router.post("/notebooks", response_model=NotebookResponse)
    def create_notebook(payload: NotebookCreateRequest) -> NotebookResponse:
        notebook = backend.metadata_store.create_notebook(
            name=payload.name,
            description=payload.description,
        )
        return NotebookResponse(**notebook)

    @router.get("/notebooks", response_model=list[NotebookResponse])
    def list_notebooks() -> list[NotebookResponse]:
        items = backend.metadata_store.list_notebooks()
        return [NotebookResponse(**item) for item in items]

    @router.get("/notebooks/{notebook_id}", response_model=NotebookDetailResponse)
    def get_notebook(notebook_id: str) -> NotebookDetailResponse:
        try:
            item = backend.source_service.get_notebook_detail(notebook_id)
            return NotebookDetailResponse(**item)
        except Exception as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.delete("/notebooks/{notebook_id}", response_model=NotebookDeleteResponse)
    def delete_notebook(notebook_id: str) -> NotebookDeleteResponse:
        try:
            result = backend.source_service.delete_notebook(notebook_id)
            return NotebookDeleteResponse(**result)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post(
        "/notebooks/{notebook_id}/sources",
        response_model=SourceLinkResponse,
    )
    def link_source_to_notebook(
        notebook_id: str,
        payload: SourceLinkRequest,
    ) -> SourceLinkResponse:
        try:
            linked = backend.source_service.link_source_to_notebook(
                notebook_id,
                payload.source_id,
            )
            return SourceLinkResponse(
                notebook_id=notebook_id,
                source_id=payload.source_id,
                linked=linked,
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete(
        "/notebooks/{notebook_id}/sources/{source_id}",
        response_model=SourceLinkResponse,
    )
    def unlink_source_from_notebook(
        notebook_id: str,
        source_id: str,
    ) -> SourceLinkResponse:
        try:
            unlinked = backend.source_service.unlink_source_from_notebook(
                notebook_id,
                source_id,
            )
            if not unlinked:
                raise HTTPException(status_code=404, detail="Source link not found")
            return SourceLinkResponse(
                notebook_id=notebook_id,
                source_id=source_id,
                linked=False,
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/prompts", response_model=list[PromptTemplateResponse])
    def list_prompts() -> list[PromptTemplateResponse]:
        items = backend.metadata_store.list_prompt_templates()
        return [PromptTemplateResponse(**item) for item in items]

    @router.get("/prompts/{name}", response_model=PromptTemplateResponse)
    def get_prompt(name: str) -> PromptTemplateResponse:
        item = backend.metadata_store.get_prompt_template(name)
        if item is None:
            raise HTTPException(status_code=404, detail="Prompt template not found")
        return PromptTemplateResponse(**item)

    @router.put("/prompts/{name}", response_model=PromptTemplateResponse)
    def update_prompt(name: str, payload: PromptTemplateUpdateRequest) -> PromptTemplateResponse:
        item = backend.metadata_store.upsert_prompt_template(name, payload.content)
        return PromptTemplateResponse(**item)

    @router.post("/prompts/bootstrap-defaults", response_model=PromptBootstrapResponse)
    def bootstrap_prompt_defaults() -> PromptBootstrapResponse:
        templates = _default_prompt_templates()
        names: list[str] = []
        for name, content in templates.items():
            backend.metadata_store.upsert_prompt_template(name, content)
            names.append(name)
        return PromptBootstrapResponse(upserted=len(names), names=sorted(names))

    @router.get("/resources/stats", response_model=ResourceStatsResponse)
    def get_resource_stats() -> ResourceStatsResponse:
        stats = backend.source_service.get_resource_stats()
        return ResourceStatsResponse(**stats)

    @router.get("/notebooks/{notebook_id}/notes", response_model=list[NoteResponse])
    def list_notes(notebook_id: str) -> list[NoteResponse]:
        try:
            items = backend.metadata_store.list_notes(notebook_id)
            return [NoteResponse(**item) for item in items]
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/notebooks/{notebook_id}/notes", response_model=NoteResponse)
    def create_note(notebook_id: str, payload: NoteCreateRequest) -> NoteResponse:
        try:
            item = backend.metadata_store.create_note(
                notebook_id=notebook_id,
                content=payload.content,
                source_id=payload.source_id,
                source_ids=payload.source_ids,
            )
            return NoteResponse(**item)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/notes/{note_id}", response_model=NoteResponse)
    def update_note(note_id: str, payload: NoteUpdateRequest) -> NoteResponse:
        try:
            item = backend.metadata_store.update_note(note_id, payload.content)
            if item is None:
                raise HTTPException(status_code=404, detail="Note not found")
            return NoteResponse(**item)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete("/notes/{note_id}", response_model=NoteDeleteResponse)
    def delete_note(note_id: str) -> NoteDeleteResponse:
        try:
            deleted = backend.metadata_store.delete_note(note_id)
            if not deleted:
                raise HTTPException(status_code=404, detail="Note not found")
            return NoteDeleteResponse(success=True, note_id=note_id)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post(
        "/notebooks/{notebook_id}/audio-overview",
        response_model=JobSubmissionResponse,
        status_code=202,
    )
    def create_audio_overview(
        notebook_id: str,
        payload: AudioOverviewRequest,
    ) -> JobSubmissionResponse:
        try:
            backend.source_service.get_notebook_detail(notebook_id)
            job = backend.job_manager.enqueue(
                "audio_overview_generation",
                {
                    "notebook_id": notebook_id,
                    "briefing": payload.briefing,
                    "provider": payload.provider,
                    "model": payload.model,
                    "temperature": payload.temperature,
                },
            )
            backend.metadata_store.upsert_audio_overview(
                notebook_id=notebook_id,
                job_id=job["id"],
                status=job["status"],
            )
            return JobSubmissionResponse(
                job_id=job["id"],
                job_type=job["job_type"],
                status=job["status"],
                created_at=job["created_at"],
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get(
        "/notebooks/{notebook_id}/audio-overview",
        response_model=AudioOverviewResponse,
    )
    def get_audio_overview(notebook_id: str) -> AudioOverviewResponse:
        try:
            item = backend.source_service.get_audio_overview(notebook_id)
            if item is None:
                raise HTTPException(status_code=404, detail="Audio overview not found")
            return AudioOverviewResponse(
                notebook_id=item["notebook_id"],
                job_id=item["job_id"],
                status=item["status"],
                audio_path=item.get("audio_path"),
                script=item.get("script"),
                error=item.get("error"),
                updated_at=item["updated_at"],
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/podcasts/generate", response_model=PodcastGenerationResponse, status_code=202)
    def generate_podcast(payload: PodcastGenerationRequest) -> PodcastGenerationResponse:
        """Generate a podcast episode. Forwards to remote API if configured, otherwise
        enqueues a local audio overview job as a lightweight fallback.
        """
        try:
            remote_urls = _resolve_remote_urls("/podcasts/generate")
            if remote_urls:
                request_body = payload.model_dump(exclude_none=True)
                last_request_error: Exception | None = None
                saw_not_found = False

                for url in remote_urls:
                    try:
                        with httpx.Client(timeout=45.0) as client:
                            response = client.post(url, json=request_body)

                        if response.status_code == 404:
                            saw_not_found = True
                            continue

                        response.raise_for_status()
                        data = response.json() if response.content else {}
                        if not isinstance(data, dict):
                            raise HTTPException(
                                status_code=502,
                                detail="Remote podcast API returned invalid JSON payload",
                            )

                        remote_job_id = str(data.get("job_id") or data.get("jobId") or "")
                        if not remote_job_id:
                            raise HTTPException(
                                status_code=502,
                                detail="Remote podcast API response missing job_id",
                            )

                        return PodcastGenerationResponse(
                            job_id=remote_job_id,
                            status=str(data.get("status") or "submitted"),
                            message=str(data.get("message") or "Submitted to remote API"),
                            episode_profile=payload.episode_profile,
                            episode_name=payload.episode_name,
                        )
                    except httpx.HTTPStatusError as exc:
                        detail = exc.response.text.strip() or str(exc)
                        raise HTTPException(
                            status_code=502,
                            detail=f"Remote podcast API error at {url}: {detail}",
                        ) from exc
                    except httpx.RequestError as exc:
                        last_request_error = exc

                if saw_not_found:
                    raise HTTPException(
                        status_code=502,
                        detail=(
                            "Remote podcast endpoint not found. "
                            "Set remote_api_base_url to include the proper API prefix."
                        ),
                    )

                if last_request_error is not None:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Remote podcast API unreachable: {last_request_error}",
                    ) from last_request_error

            # Local fallback: require either notebook_id or content
            content_text = (payload.content or "").strip()
            if not payload.notebook_id and not content_text:
                raise HTTPException(status_code=400, detail="Either content or notebook_id is required")

            if payload.notebook_id:
                backend.source_service.get_notebook_detail(payload.notebook_id)

            briefing = payload.briefing_suffix or f"Episode: {payload.episode_name}"
            job_payload = {
                "notebook_id": payload.notebook_id,
                "briefing": briefing,
                "provider": None,
                "model": None,
                "temperature": 0.3,
                "content": content_text or None,
            }
            job = backend.job_manager.enqueue("audio_overview_generation", job_payload)
            return PodcastGenerationResponse(
                job_id=job["id"],
                status=job["status"],
                message="Podcast generation queued (local overview fallback)",
                episode_profile=payload.episode_profile,
                episode_name=payload.episode_name,
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.get("/podcasts/jobs/{job_id}", response_model=JobStatusResponse)
    def get_podcast_job_status(job_id: str) -> JobStatusResponse:
        try:
            remote_urls = _resolve_remote_urls(f"/podcasts/jobs/{job_id}")
            if remote_urls:
                last_request_error: Exception | None = None
                saw_not_found = False

                for url in remote_urls:
                    try:
                        with httpx.Client(timeout=30.0) as client:
                            response = client.get(url)

                        if response.status_code == 404:
                            saw_not_found = True
                            continue

                        response.raise_for_status()
                        data = response.json() if response.content else {}
                        if not isinstance(data, dict):
                            data = {
                                "id": job_id,
                                "status": "running",
                                "result": data,
                            }
                        return _to_job_status_response(job_id, data)
                    except httpx.HTTPStatusError as exc:
                        detail = exc.response.text.strip() or str(exc)
                        raise HTTPException(
                            status_code=502,
                            detail=f"Remote podcast job API error at {url}: {detail}",
                        ) from exc
                    except httpx.RequestError as exc:
                        last_request_error = exc

                if saw_not_found:
                    raise HTTPException(status_code=404, detail="Podcast job not found on remote API")

                if last_request_error is not None:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Remote podcast API unreachable: {last_request_error}",
                    ) from last_request_error

            job = backend.job_manager.get_job(job_id)
            if job is None:
                raise HTTPException(status_code=404, detail="Job not found")
            return JobStatusResponse(**job)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.post("/sources/text", response_model=SourceResponse)
    def create_text_source(payload: SourceTextCreateRequest) -> SourceResponse:
        try:
            source = backend.source_service.create_text_source(
                notebook_id=payload.notebook_id,
                content=payload.content,
                title=payload.title,
                embed=payload.embed,
            )
            return SourceResponse(**source)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post(
        "/sources/text/async",
        response_model=JobSubmissionResponse,
        status_code=202,
    )
    def create_text_source_async(payload: SourceTextCreateRequest) -> JobSubmissionResponse:
        try:
            job = backend.job_manager.enqueue(
                "source_ingestion",
                {
                    "type": "text",
                    "notebook_id": payload.notebook_id,
                    "content": payload.content,
                    "title": payload.title,
                    "embed": payload.embed,
                },
            )
            return JobSubmissionResponse(
                job_id=job["id"],
                job_type=job["job_type"],
                status=job["status"],
                created_at=job["created_at"],
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/sources/url", response_model=SourceResponse)
    def create_url_source(payload: SourceUrlCreateRequest) -> SourceResponse:
        try:
            source = backend.source_service.create_url_source(
                notebook_id=payload.notebook_id,
                url=payload.url,
                title=payload.title,
                embed=payload.embed,
            )
            return SourceResponse(**source)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post(
        "/sources/url/async",
        response_model=JobSubmissionResponse,
        status_code=202,
    )
    def create_url_source_async(payload: SourceUrlCreateRequest) -> JobSubmissionResponse:
        try:
            job = backend.job_manager.enqueue(
                "source_ingestion",
                {
                    "type": "url",
                    "notebook_id": payload.notebook_id,
                    "url": payload.url,
                    "title": payload.title,
                    "embed": payload.embed,
                },
            )
            return JobSubmissionResponse(
                job_id=job["id"],
                job_type=job["job_type"],
                status=job["status"],
                created_at=job["created_at"],
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/sources/file", response_model=SourceResponse)
    async def create_file_source(
        notebook_id: str = Form(...),
        title: str | None = Form(None),
        embed: bool = Form(True),
        file: UploadFile = File(...),
    ) -> SourceResponse:
        upload_dir = backend.settings.resolve_upload_dir()
        safe_name = Path(file.filename or f"upload-{uuid4().hex}").name
        target = upload_dir / f"{uuid4().hex}-{safe_name}"

        content = await file.read()
        if len(content) > backend.settings.max_upload_bytes():
            raise HTTPException(status_code=413, detail="Uploaded file is too large")
        target.write_bytes(content)

        try:
            source = backend.source_service.create_file_source(
                notebook_id=notebook_id,
                file_path=target,
                title=title,
                embed=embed,
            )
            return SourceResponse(**source)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post(
        "/sources/file/async",
        response_model=JobSubmissionResponse,
        status_code=202,
    )
    async def create_file_source_async(
        notebook_id: str = Form(...),
        title: str | None = Form(None),
        embed: bool = Form(True),
        file: UploadFile = File(...),
    ) -> JobSubmissionResponse:
        upload_dir = backend.settings.resolve_upload_dir()
        safe_name = Path(file.filename or f"upload-{uuid4().hex}").name
        target = upload_dir / f"{uuid4().hex}-{safe_name}"
        content = await file.read()
        if len(content) > backend.settings.max_upload_bytes():
            raise HTTPException(status_code=413, detail="Uploaded file is too large")
        target.write_bytes(content)

        try:
            job = backend.job_manager.enqueue(
                "source_ingestion",
                {
                    "type": "file",
                    "notebook_id": notebook_id,
                    "file_path": str(target),
                    "title": title,
                    "embed": embed,
                },
            )
            return JobSubmissionResponse(
                job_id=job["id"],
                job_type=job["job_type"],
                status=job["status"],
                created_at=job["created_at"],
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/sources", response_model=list[SourceListResponse])
    def list_sources(
        notebook_id: str | None = Query(default=None),
    ) -> list[SourceListResponse]:
        items = backend.source_service.list_sources(notebook_id=notebook_id)
        return [SourceListResponse(**item) for item in items]

    @router.get("/sources/{source_id}", response_model=SourceResponse)
    def get_source(source_id: str) -> SourceResponse:
        source = backend.source_service.get_source(source_id)
        if source is None:
            raise HTTPException(status_code=404, detail="Source not found")
        return SourceResponse(**source)

    @router.delete("/sources/{source_id}", response_model=SourceDeleteResponse)
    def delete_source(source_id: str) -> SourceDeleteResponse:
        try:
            result = backend.source_service.delete_source(source_id)
            return SourceDeleteResponse(**result)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/vector-db/init", response_model=VectorDbInitResponse)
    def initialize_vector_db() -> VectorDbInitResponse:
        try:
            result = backend.source_service.initialize_vector_db()
            return VectorDbInitResponse(**result)
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Vector DB unavailable: {exc}") from exc

    @router.get("/vector-db/stats", response_model=VectorDbInitResponse)
    def get_vector_db_stats() -> VectorDbInitResponse:
        try:
            result = backend.source_service.initialize_vector_db()
            return VectorDbInitResponse(**result)
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Vector DB unavailable: {exc}") from exc

    @router.post("/vector-db/rebuild", response_model=VectorRebuildResponse)
    def rebuild_vector_db(payload: VectorRebuildRequest) -> VectorRebuildResponse:
        try:
            result = backend.source_service.rebuild_vector_db(
                notebook_id=payload.notebook_id,
                source_ids=payload.source_ids,
            )
            return VectorRebuildResponse(**result)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post(
        "/vector-db/rebuild/async",
        response_model=JobSubmissionResponse,
        status_code=202,
    )
    def rebuild_vector_db_async(payload: VectorRebuildRequest) -> JobSubmissionResponse:
        try:
            job = backend.job_manager.enqueue(
                "vector_rebuild",
                {
                    "notebook_id": payload.notebook_id,
                    "source_ids": payload.source_ids,
                },
            )
            return JobSubmissionResponse(
                job_id=job["id"],
                job_type=job["job_type"],
                status=job["status"],
                created_at=job["created_at"],
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/search", response_model=SearchResponse)
    def search(payload: SearchRequest) -> SearchResponse:
        try:
            results = backend.source_service.search(
                notebook_id=payload.notebook_id,
                query=payload.query,
                k=payload.k,
                source_ids=payload.source_ids,
            )
            return SearchResponse(results=results)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/chat/sessions", response_model=ChatSessionResponse)
    def create_chat_session(payload: CreateChatSessionRequest) -> ChatSessionResponse:
        try:
            session = backend.chat_service.create_session(
                notebook_id=payload.notebook_id,
                title=payload.title,
                provider=payload.provider,
                model=payload.model,
            )
            return ChatSessionResponse(**session)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/chat/sessions", response_model=list[ChatSessionResponse])
    def list_chat_sessions(notebook_id: str = Query(...)) -> list[ChatSessionResponse]:
        items = backend.chat_service.list_sessions(notebook_id)
        return [ChatSessionResponse(**item) for item in items]

    @router.get("/chat/sessions/{session_id}", response_model=ChatSessionDetailResponse)
    def get_chat_session(session_id: str) -> ChatSessionDetailResponse:
        try:
            detail = backend.chat_service.get_session_detail(session_id)
            return ChatSessionDetailResponse(
                session=ChatSessionResponse(**detail["session"]),
                messages=detail["messages"],
            )
        except Exception as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.post(
        "/chat/sessions/{session_id}/messages",
        response_model=ChatMessageResponse,
    )
    def send_chat_message(
        session_id: str,
        payload: ChatMessageRequest,
    ) -> ChatMessageResponse:
        try:
            result = backend.chat_service.send_message(
                session_id=session_id,
                message=payload.message,
                provider=payload.provider,
                model=payload.model,
                retrieval_k=payload.retrieval_k,
                temperature=payload.temperature,
                source_ids=payload.source_ids,
            )
            return ChatMessageResponse(**result)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/models", response_model=ModelInfoResponse)
    def models() -> ModelInfoResponse:
        return ModelInfoResponse(**backend.model_service.get_model_info())

    @router.get("/jobs", response_model=list[JobStatusResponse])
    def list_jobs(
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ) -> list[JobStatusResponse]:
        jobs = backend.job_manager.list_jobs(limit=limit, offset=offset)
        return [JobStatusResponse(**item) for item in jobs]

    @router.get("/jobs/{job_id}", response_model=JobStatusResponse)
    def get_job(job_id: str) -> JobStatusResponse:
        job = backend.job_manager.get_job(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        return JobStatusResponse(**job)

    @router.post("/speech/transcribe", response_model=TranscribeResponse)
    async def transcribe(file: UploadFile = File(...)) -> TranscribeResponse:
        upload_dir = backend.settings.resolve_upload_dir()
        safe_name = Path(file.filename or f"audio-{uuid4().hex}").name
        target = upload_dir / f"{uuid4().hex}-{safe_name}"
        target.write_bytes(await file.read())

        try:
            text = backend.speech_service.transcribe(target)
            return TranscribeResponse(text=text)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/speech/synthesize")
    def synthesize(payload: SynthesizeRequest) -> FileResponse:
        try:
            audio_path = backend.speech_service.synthesize(
                text=payload.text,
                language=payload.language,
            )
            return FileResponse(
                path=str(audio_path),
                filename=audio_path.name,
                media_type="audio/mpeg",
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router


def _default_prompt_templates() -> dict[str, str]:
    return {
        "chat_system": (
            "You are a strictly grounded retrieval assistant. "
            "Use only information from the provided Context block. "
            "Every factual statement must include one or more inline citations "
            "using [n] where n matches a Context citation index. "
            "Do not invent facts. Do not invent citations. "
            "If context is insufficient, explicitly say what is missing."
        ),
        "audio_overview_outline_system": (
            "You are an AI assistant specialized in creating podcast outlines. "
            "Create a concise multi-segment outline based only on context and briefing. "
            "Return strict JSON: {\"segments\": [{\"name\": \"...\", \"description\": \"...\", \"size\": \"short|medium|long\"}]}"
        ),
        "audio_overview_outline_user": (
            "Briefing:\n{briefing}\n\n"
            "Context:\n{context}\n\n"
            "Generate 5-7 logical segments with introduction and conclusion. "
            "Return only JSON object."
        ),
        "audio_overview_script_system": (
            "You are an AI assistant specialized in creating podcast transcripts. "
            "Generate an engaging two-speaker discussion grounded in context only. "
            "Return strict JSON with shape: "
            "{\"transcript\": [{\"speaker\": \"Speaker 1\", \"dialogue\": \"...\"}, {\"speaker\": \"Speaker 2\", \"dialogue\": \"...\"}]}. "
            "No markdown fences."
        ),
        "audio_overview_script_user": (
            "Briefing:\n{briefing}\n\n"
            "Context:\n{context}\n\n"
            "Create a natural 10-16 turn transcript between Speaker 1 and Speaker 2. "
            "Each turn should be concise and informative, with smooth transitions and practical takeaways. "
            "Return only JSON object."
        ),
    }
