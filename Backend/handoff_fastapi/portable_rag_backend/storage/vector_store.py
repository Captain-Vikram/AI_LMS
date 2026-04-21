from __future__ import annotations

import hashlib
from pathlib import Path
from threading import Lock
from typing import Any

from langchain_chroma import Chroma
from langchain_core.documents import Document

from portable_rag_backend.providers.embeddings import EmbeddingProviderManager
from portable_rag_backend.utils.chunking import split_text

try:
    from chromadb.api.shared_system_client import SharedSystemClient
except Exception:  # pragma: no cover - defensive import for compatibility
    SharedSystemClient = None  # type: ignore[assignment]


class PortableVectorStore:
    """Wrapper around Chroma that tracks embedding-provider changes."""

    def __init__(
        self,
        persist_directory: Path,
        collection_name: str,
        embedding_manager: EmbeddingProviderManager,
    ):
        self.persist_directory = Path(persist_directory)
        self.persist_directory.mkdir(parents=True, exist_ok=True)
        self.collection_name = collection_name
        self.embedding_manager = embedding_manager
        self._store: Chroma | None = None
        self._signature: str | None = None
        self._active_collection_name: str | None = None
        self._lock = Lock()

    def _resolve_collection_name(self, signature: str) -> str:
        # Keep a stable per-signature collection to avoid vector-dimension
        # conflicts when switching embedding providers/models.
        digest = hashlib.sha1(signature.encode("utf-8")).hexdigest()[:12]
        return f"{self.collection_name}__{digest}"

    def _clear_failed_chroma_system(self) -> None:
        if SharedSystemClient is None:
            return

        systems = getattr(SharedSystemClient, "_identifier_to_system", None)
        if not isinstance(systems, dict):
            return

        identifier = str(self.persist_directory)
        system = systems.pop(identifier, None)
        if system is None:
            return

        try:
            system.stop()
        except Exception:
            pass

    def _get_store(self) -> Chroma:
        signature = self.embedding_manager.signature()
        resolved_collection_name = self._resolve_collection_name(signature)
        with self._lock:
            if (
                self._store is not None
                and self._signature == signature
                and self._active_collection_name == resolved_collection_name
            ):
                return self._store

            embeddings = self.embedding_manager.get_embeddings()
            last_error: Exception | None = None

            # Chroma Rust client can intermittently fail during tenant validation on
            # Windows; clean stale shared client state and retry once.
            for _ in range(2):
                try:
                    self._store = Chroma(
                        collection_name=resolved_collection_name,
                        persist_directory=str(self.persist_directory),
                        embedding_function=embeddings,
                    )
                    self._signature = signature
                    self._active_collection_name = resolved_collection_name
                    return self._store
                except Exception as exc:
                    last_error = exc
                    self._store = None
                    self._signature = None
                    self._active_collection_name = None
                    self._clear_failed_chroma_system()

            raise RuntimeError(
                "Unable to initialize persistent Chroma vector store "
                f"at '{self.persist_directory}'"
            ) from last_error

    def initialize(self) -> dict[str, Any]:
        store = self._get_store()
        collection_name = self._active_collection_name or self.collection_name
        # Defensive fallback in case internal attribute names change upstream.
        if not collection_name:
            collection_name = str(getattr(store, "_collection_name", self.collection_name))
        return {
            "initialized": True,
            "collection_name": collection_name,
            "vector_documents_count": self.count_documents(),
            "persist_directory": str(self.persist_directory),
        }

    def delete_source(self, source_id: str) -> None:
        store = self._get_store()
        store.delete(where={"source_id": source_id})

    def count_documents(self) -> int:
        store = self._get_store()
        collection = getattr(store, "_collection", None)
        if collection is None:
            return 0
        counter = getattr(collection, "count", None)
        if callable(counter):
            return int(counter())
        return 0

    def upsert_source(
        self,
        *,
        source_id: str,
        notebook_id: str,
        title: str,
        text: str,
        chunk_size: int,
        chunk_overlap: int,
    ) -> int:
        store = self._get_store()
        chunks = split_text(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)

        if not chunks:
            return 0

        chunk_spans = _locate_chunk_spans(text=text, chunks=chunks)

        store.delete(where={"source_id": source_id})

        docs: list[Document] = []
        ids: list[str] = []
        for idx, chunk in enumerate(chunks):
            chunk_id = f"{source_id}:{idx}"
            span = chunk_spans[idx]
            ids.append(chunk_id)
            docs.append(
                Document(
                    page_content=chunk,
                    metadata={
                        "chunk_id": chunk_id,
                        "source_id": source_id,
                        "notebook_id": notebook_id,
                        "title": title,
                        "chunk_index": idx,
                        "start_char": span["start_char"],
                        "end_char": span["end_char"],
                        "line_start": span["line_start"],
                        "line_end": span["line_end"],
                    },
                )
            )

        store.add_documents(documents=docs, ids=ids)
        return len(docs)

    def similarity_search(
        self,
        *,
        notebook_id: str | None,
        query: str,
        k: int,
        source_ids: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        store = self._get_store()
        requested_sources = {item for item in (source_ids or []) if item}
        search_k = max(k * 5, 30) if requested_sources else k

        if requested_sources:
            rows = store.similarity_search_with_score(
                query,
                k=search_k,
            )
        elif notebook_id:
            rows = store.similarity_search_with_score(
                query,
                k=search_k,
                filter={"notebook_id": notebook_id},
            )
        else:
            rows = store.similarity_search_with_score(
                query,
                k=search_k,
            )

        if requested_sources:
            rows = [
                (doc, score)
                for doc, score in rows
                if str(doc.metadata.get("source_id")) in requested_sources
            ][:k]

        results: list[dict[str, Any]] = []
        for doc, distance in rows:
            snippet = doc.page_content.strip()
            if len(snippet) > 400:
                snippet = snippet[:400].rstrip() + "..."

            results.append(
                {
                    "chunk_id": doc.metadata.get("chunk_id"),
                    "source_id": doc.metadata.get("source_id"),
                    "title": doc.metadata.get("title"),
                    "chunk_index": doc.metadata.get("chunk_index"),
                    "line_start": doc.metadata.get("line_start"),
                    "line_end": doc.metadata.get("line_end"),
                    "start_char": doc.metadata.get("start_char"),
                    "end_char": doc.metadata.get("end_char"),
                    "score": _distance_to_relevance(distance),
                    "content": doc.page_content,
                    "snippet": snippet,
                }
            )
        return results


def _distance_to_relevance(distance: Any) -> float:
    """Convert vector distance to a stable [0, 1] relevance score.

    Chroma distances are lower-is-better and can vary by metric. We map them to
    a bounded similarity-like score to keep downstream behavior predictable.
    """
    try:
        numeric = float(distance)
    except (TypeError, ValueError):
        return 0.0

    if numeric < 0:
        numeric = 0.0

    # Monotonic transform: distance 0 -> 1.0, large distance -> approaches 0.
    return 1.0 / (1.0 + numeric)


def _locate_chunk_spans(text: str, chunks: list[str]) -> list[dict[str, int]]:
    """Best-effort mapping from chunk text to character and line ranges."""
    spans: list[dict[str, int]] = []
    cursor = 0

    for chunk in chunks:
        start = text.find(chunk, cursor)
        if start < 0:
            start = text.find(chunk)
        if start < 0:
            start = cursor

        end = start + len(chunk)
        cursor = max(cursor, end)

        line_start = text.count("\n", 0, start) + 1
        line_end = text.count("\n", 0, end) + 1

        spans.append(
            {
                "start_char": start,
                "end_char": end,
                "line_start": line_start,
                "line_end": line_end,
            }
        )

    return spans
