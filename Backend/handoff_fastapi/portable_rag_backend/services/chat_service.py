from __future__ import annotations

from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from portable_rag_backend.config import PortableRAGSettings
from portable_rag_backend.providers.llm import LLMProviderManager
from portable_rag_backend.storage.metadata import MetadataStore
from portable_rag_backend.storage.vector_store import PortableVectorStore


class ChatService:
    def __init__(
        self,
        *,
        settings: PortableRAGSettings,
        metadata_store: MetadataStore,
        vector_store: PortableVectorStore,
        llm_manager: LLMProviderManager,
    ):
        self.settings = settings
        self.metadata_store = metadata_store
        self.vector_store = vector_store
        self.llm_manager = llm_manager

    def create_session(
        self,
        *,
        notebook_id: str,
        title: str | None,
        provider: str | None,
        model: str | None,
    ) -> dict[str, Any]:
        notebook = self.metadata_store.get_notebook(notebook_id)
        if notebook is None:
            raise ValueError(f"Notebook '{notebook_id}' not found")

        active_provider = self.llm_manager.normalize_provider_name(
            provider or self.settings.default_chat_provider
        )
        active_model = self.llm_manager.resolve_chat_model(
            provider=active_provider,
            model=model,
        )

        return self.metadata_store.create_chat_session(
            notebook_id=notebook_id,
            title=title or "RAG Chat Session",
            provider=active_provider,
            model=active_model,
        )

    def list_sessions(self, notebook_id: str) -> list[dict[str, Any]]:
        return self.metadata_store.list_chat_sessions(notebook_id)

    def get_session_detail(self, session_id: str) -> dict[str, Any]:
        session = self.metadata_store.get_chat_session(session_id)
        if session is None:
            raise ValueError(f"Session '{session_id}' not found")
        messages = self.metadata_store.get_messages(session_id)
        return {"session": session, "messages": messages}

    def send_message(
        self,
        *,
        session_id: str,
        message: str,
        provider: str | None,
        model: str | None,
        retrieval_k: int | None,
        temperature: float,
        source_ids: list[str] | None,
    ) -> dict[str, Any]:
        session = self.metadata_store.get_chat_session(session_id)
        if session is None:
            raise ValueError(f"Session '{session_id}' not found")

        active_provider = self.llm_manager.normalize_provider_name(
            provider or session["provider"]
        )
        requested_model = model or session["model"]

        allowed_sources = self.metadata_store.list_source_ids(session["notebook_id"])
        selected_source_ids = _normalize_source_ids(source_ids)
        if selected_source_ids:
            invalid_ids = [sid for sid in selected_source_ids if sid not in allowed_sources]
            if invalid_ids:
                joined = ", ".join(sorted(invalid_ids))
                raise ValueError(
                    f"Selected source IDs are not in this notebook: {joined}"
                )
            effective_source_ids = selected_source_ids
        else:
            effective_source_ids = sorted(allowed_sources)

        self.metadata_store.append_message(session_id, role="user", content=message)

        citations = self.vector_store.similarity_search(
            notebook_id=None,
            query=message,
            k=retrieval_k or self.settings.default_retrieval_k,
            source_ids=effective_source_ids,
        )

        citation_map = _build_citation_map(citations)

        context_lines = []
        for item in citation_map:
            source_title = item.get("title") or "Untitled Source"
            line_start = item.get("line_start")
            line_end = item.get("line_end")
            line_range = ""
            if isinstance(line_start, int):
                line_range = f" (lines {line_start}-{line_end or line_start})"

            context_lines.append(
                f"[{item['index']}] {source_title}{line_range}\n{item.get('content', '')}"
            )

        history = self.metadata_store.get_messages(session_id)
        window_size = self.settings.chat_history_window * 2
        recent = history[-window_size:]

        system_prompt = self._get_system_prompt()

        prompt_messages: list[Any] = [SystemMessage(content=system_prompt)]

        for row in recent:
            if row["role"] == "user":
                prompt_messages.append(HumanMessage(content=row["content"]))
            elif row["role"] == "assistant":
                prompt_messages.append(AIMessage(content=row["content"]))

        prompt_messages.append(
            HumanMessage(
                content=(
                    "Context:\n"
                    + ("\n\n".join(context_lines) if context_lines else "(No context retrieved)")
                    + "\n\nUser question:\n"
                    + message
                )
            )
        )

        used_provider = active_provider
        used_model = str(requested_model)
        answer: str | None = None
        provider_errors: list[str] = []

        fallback_provider = self.llm_manager.normalize_provider_name(
            self.settings.llm_fallback_provider
        )
        fallback_model = (self.settings.llm_fallback_model or "").strip()

        for candidate_provider in self.llm_manager.get_chat_provider_candidates(
            preferred_provider=active_provider
        ):
            candidate_model_hint: str | None = requested_model if candidate_provider == active_provider else None
            if candidate_provider == fallback_provider and fallback_model:
                candidate_model_hint = fallback_model

            try:
                resolved_model = self.llm_manager.resolve_chat_model(
                    provider=candidate_provider,
                    model=candidate_model_hint,
                )
                model_client = self.llm_manager.get_chat_model(
                    provider=candidate_provider,
                    model=resolved_model,
                    temperature=temperature,
                )
                response = model_client.invoke(prompt_messages)
                answer = _extract_text(response.content)
                used_provider = candidate_provider
                used_model = resolved_model
                break
            except Exception as exc:
                provider_errors.append(f"{candidate_provider}: {exc}")

        if answer is None:
            model_error: Exception = RuntimeError(
                "; ".join(provider_errors) if provider_errors else "No model provider was available."
            )
            answer = _build_retrieval_fallback_answer(
                citation_map=citation_map,
                user_question=message,
                model_error=model_error,
            )

        self.metadata_store.append_message(
            session_id,
            role="assistant",
            content=answer,
            meta={
                "citation_map": citation_map,
                "selected_source_ids": effective_source_ids,
            },
        )

        if used_provider != session["provider"] or used_model != session["model"]:
            self.metadata_store.update_chat_session_model(
                session_id,
                provider=used_provider,
                model=used_model,
            )

        return {
            "session_id": session_id,
            "answer": answer,
            "citation_map": citation_map,
        }

    def _get_system_prompt(self) -> str:
        prompt = self.metadata_store.get_prompt_template("chat_system")
        if prompt and prompt.get("content"):
            return str(prompt["content"])
        return self.settings.default_chat_system_prompt


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                parts.append(str(item["text"]))
            else:
                parts.append(str(item))
        return "\n".join(parts)
    return str(content)


def _normalize_source_ids(source_ids: list[str] | None) -> list[str]:
    if not source_ids:
        return []
    seen: set[str] = set()
    normalized: list[str] = []
    for item in source_ids:
        sid = str(item).strip()
        if sid and sid not in seen:
            seen.add(sid)
            normalized.append(sid)
    return normalized


def _build_citation_map(citations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    citation_map: list[dict[str, Any]] = []
    for idx, item in enumerate(citations, start=1):
        citation_map.append(
            {
                "index": idx,
                "chunk_id": item.get("chunk_id"),
                "source_id": item.get("source_id"),
                "title": item.get("title"),
                "chunk_index": item.get("chunk_index"),
                "score": float(item.get("score") or 0.0),
                "snippet": item.get("snippet") or "",
                "content": item.get("content") or "",
                "line_start": item.get("line_start"),
                "line_end": item.get("line_end"),
                "start_char": item.get("start_char"),
                "end_char": item.get("end_char"),
            }
        )
    return citation_map


def _build_retrieval_fallback_answer(
    *,
    citation_map: list[dict[str, Any]],
    user_question: str,
    model_error: Exception,
) -> str:
    if not citation_map:
        return (
            "Model provider is unavailable and no relevant context was retrieved. "
            "Try adding sources or re-running with an available model provider."
        )

    snippets: list[str] = []
    for item in citation_map[:3]:
        snippet = str(item.get("snippet") or item.get("content") or "").strip()
        if not snippet:
            continue
        index = item.get("index")
        snippets.append(f"[{index}] {snippet}")

    source_lines = _format_fallback_sources(citation_map)

    context_block = "\n\n".join(snippets) if snippets else "No snippet preview available."
    source_block = "\n".join(source_lines) if source_lines else "(No source metadata found.)"
    return (
        "Model provider is currently unavailable, so this is a retrieval-only response "
        "grounded in indexed notebook context.\n\n"
        f"Question: {user_question}\n\n"
        f"Retrieved sources:\n{source_block}\n\n"
        f"Relevant context:\n{context_block}\n\n"
        f"Provider error: {model_error}"
    )


def _format_fallback_sources(citation_map: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    seen: set[tuple[str, str]] = set()

    for item in citation_map:
        source_id = str(item.get("source_id") or "").strip() or "unknown"
        title = str(item.get("title") or "Untitled Source").strip() or "Untitled Source"
        key = (source_id, title)
        if key in seen:
            continue
        seen.add(key)
        lines.append(f"- {title} (source_id: {source_id})")
        if len(lines) >= 8:
            break

    return lines


