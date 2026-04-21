from __future__ import annotations

import atexit
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from typing import Any, Callable

from portable_rag_backend.storage.metadata import MetadataStore

JobHandler = Callable[[dict[str, Any]], dict[str, Any]]


class JobManager:
    """Lightweight in-process job manager with persisted SQLite state."""

    def __init__(self, *, metadata_store: MetadataStore, max_workers: int = 2):
        self.metadata_store = metadata_store
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="portable-rag-job",
        )
        self._handlers: dict[str, JobHandler] = {}
        self._lock = Lock()
        atexit.register(self.shutdown)

    def register_handler(self, job_type: str, handler: JobHandler) -> None:
        with self._lock:
            self._handlers[job_type] = handler

    def enqueue(self, job_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        handler = self._handlers.get(job_type)
        if handler is None:
            raise ValueError(f"No handler registered for job_type '{job_type}'")

        job = self.metadata_store.create_job(job_type=job_type, payload=payload)
        handler_payload = dict(payload)
        handler_payload["_job_id"] = job["id"]
        self._executor.submit(self._run_job, job["id"], handler, handler_payload)
        return job

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        return self.metadata_store.get_job(job_id)

    def list_jobs(self, *, limit: int = 20, offset: int = 0) -> list[dict[str, Any]]:
        return self.metadata_store.list_jobs(limit=limit, offset=offset)

    def _run_job(
        self,
        job_id: str,
        handler: JobHandler,
        payload: dict[str, Any],
    ) -> None:
        self.metadata_store.mark_job_running(job_id)
        try:
            result = handler(payload)
            self.metadata_store.mark_job_completed(job_id, result=result)
        except Exception as exc:
            self.metadata_store.mark_job_failed(job_id, error=str(exc))

    def shutdown(self) -> None:
        try:
            self._executor.shutdown(wait=False, cancel_futures=True)
        except Exception:
            # Ignore shutdown edge-case errors during interpreter exit.
            pass
