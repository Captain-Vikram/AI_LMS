from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

from langchain_core.messages import HumanMessage, SystemMessage

from portable_rag_backend.config import PortableRAGSettings
from portable_rag_backend.providers.llm import LLMProviderManager
from portable_rag_backend.providers.speech import SpeechService
from portable_rag_backend.storage.metadata import MetadataStore
from portable_rag_backend.storage.vector_store import PortableVectorStore
from portable_rag_backend.utils.extractors import extract_text_from_file, extract_text_from_url


class SourceService:
    def __init__(
        self,
        *,
        settings: PortableRAGSettings,
        metadata_store: MetadataStore,
        vector_store: PortableVectorStore,
        llm_manager: LLMProviderManager,
        speech_service: SpeechService,
    ):
        self.settings = settings
        self.metadata_store = metadata_store
        self.vector_store = vector_store
        self.llm_manager = llm_manager
        self.speech_service = speech_service

    def list_sources(self, notebook_id: str | None = None) -> list[dict[str, Any]]:
        return self.metadata_store.list_sources(notebook_id=notebook_id)

    def get_source(self, source_id: str) -> dict[str, Any] | None:
        return self.metadata_store.get_source(source_id)

    def get_notebook_detail(self, notebook_id: str) -> dict[str, Any]:
        notebook = self.metadata_store.get_notebook_detail(notebook_id)
        if notebook is None:
            raise ValueError(f"Notebook '{notebook_id}' not found")
        return notebook

    def delete_notebook(self, notebook_id: str) -> dict[str, Any]:
        return self.metadata_store.delete_notebook(notebook_id)

    def link_source_to_notebook(self, notebook_id: str, source_id: str) -> bool:
        return self.metadata_store.link_source_to_notebook(notebook_id, source_id)

    def unlink_source_from_notebook(self, notebook_id: str, source_id: str) -> bool:
        return self.metadata_store.unlink_source_from_notebook(notebook_id, source_id)

    def delete_source(self, source_id: str) -> dict[str, Any]:
        source = self.metadata_store.get_source(source_id)
        if source is None:
            raise ValueError(f"Source '{source_id}' not found")

        self.vector_store.delete_source(source_id)
        deleted = self.metadata_store.delete_source(source_id)
        if not deleted:
            raise ValueError(f"Failed to delete source '{source_id}'")

        return {
            "success": True,
            "source_id": source_id,
            "vectors_deleted": True,
        }

    def create_text_source(
        self,
        *,
        notebook_id: str,
        content: str,
        title: str | None,
        embed: bool,
    ) -> dict[str, Any]:
        return self._create_source(
            notebook_id=notebook_id,
            title=title or "Text Source",
            source_type="text",
            origin=None,
            content=content,
            embed=embed,
        )

    def create_url_source(
        self,
        *,
        notebook_id: str,
        url: str,
        title: str | None,
        embed: bool,
    ) -> dict[str, Any]:
        extracted = extract_text_from_url(url)
        return self._create_source(
            notebook_id=notebook_id,
            title=title or url,
            source_type="url",
            origin=url,
            content=extracted,
            embed=embed,
        )

    def create_file_source(
        self,
        *,
        notebook_id: str,
        file_path: Path,
        title: str | None,
        embed: bool,
    ) -> dict[str, Any]:
        self._validate_file_resource(file_path)
        extracted = extract_text_from_file(file_path, speech_service=self.speech_service)
        return self._create_source(
            notebook_id=notebook_id,
            title=title or file_path.name,
            source_type="file",
            origin=str(file_path),
            content=extracted,
            embed=embed,
        )

    def search(
        self,
        *,
        notebook_id: str,
        query: str,
        k: int,
        source_ids: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        allowed_source_ids = self.metadata_store.list_source_ids(notebook_id)
        if not allowed_source_ids:
            return []

        requested_source_ids = _normalize_source_ids(source_ids)
        if requested_source_ids:
            invalid_ids = [sid for sid in requested_source_ids if sid not in allowed_source_ids]
            if invalid_ids:
                joined = ", ".join(sorted(invalid_ids))
                raise ValueError(
                    f"Selected source IDs are not in this notebook: {joined}"
                )
            effective_source_ids = requested_source_ids
        else:
            effective_source_ids = sorted(allowed_source_ids)

        return self.vector_store.similarity_search(
            notebook_id=None,
            query=query,
            k=k,
            source_ids=effective_source_ids,
        )

    def process_ingestion_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        source_type = str(payload.get("type") or "").strip().lower()
        notebook_id = str(payload.get("notebook_id") or "").strip()
        title = payload.get("title")
        embed = bool(payload.get("embed", True))

        if not notebook_id:
            raise ValueError("notebook_id is required")

        if source_type == "text":
            content = str(payload.get("content") or "")
            if not content.strip():
                raise ValueError("content is required for text source ingestion")
            source = self.create_text_source(
                notebook_id=notebook_id,
                content=content,
                title=title,
                embed=embed,
            )
        elif source_type == "url":
            url = str(payload.get("url") or "")
            if not url.strip():
                raise ValueError("url is required for url source ingestion")
            source = self.create_url_source(
                notebook_id=notebook_id,
                url=url,
                title=title,
                embed=embed,
            )
        elif source_type == "file":
            file_path_raw = payload.get("file_path")
            if not file_path_raw:
                raise ValueError("file_path is required for file source ingestion")

            file_path = Path(str(file_path_raw))
            if not file_path.exists():
                raise ValueError(f"file_path does not exist: {file_path}")

            source = self.create_file_source(
                notebook_id=notebook_id,
                file_path=file_path,
                title=title,
                embed=embed,
            )
        else:
            raise ValueError(
                "Unsupported ingestion payload type. Expected one of: text, url, file"
            )

        return {
            "source": source,
            "message": "Source ingestion completed",
        }

    def initialize_vector_db(self) -> dict[str, Any]:
        return self.vector_store.initialize()

    def rebuild_vector_db(
        self,
        *,
        notebook_id: str | None = None,
        source_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        selected_source_ids = source_ids
        if notebook_id and not selected_source_ids:
            selected_source_ids = sorted(self.metadata_store.list_source_ids(notebook_id))

        sources = self.metadata_store.list_sources(
            notebook_id=notebook_id,
            source_ids=selected_source_ids,
        )

        rebuilt = 0
        skipped = 0

        for source in sources:
            content = str(source.get("content") or "")
            if not content.strip():
                skipped += 1
                continue

            chunk_count = self.vector_store.upsert_source(
                source_id=str(source["id"]),
                notebook_id=str(source["notebook_id"]),
                title=str(source.get("title") or "Untitled Source"),
                text=content,
                chunk_size=self.settings.default_chunk_size,
                chunk_overlap=self.settings.default_chunk_overlap,
            )
            self.metadata_store.update_source_chunk_count(str(source["id"]), chunk_count)
            rebuilt += 1

        return {
            "rebuilt_sources": rebuilt,
            "skipped_sources": skipped,
            "vector_documents_count": self.vector_store.count_documents(),
        }

    def process_vector_rebuild_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        notebook_id_raw = payload.get("notebook_id")
        notebook_id = str(notebook_id_raw).strip() if notebook_id_raw else None
        source_ids = payload.get("source_ids")
        source_ids_list = list(source_ids) if isinstance(source_ids, list) else None

        return self.rebuild_vector_db(
            notebook_id=notebook_id,
            source_ids=source_ids_list,
        )

    def get_resource_stats(self) -> dict[str, int]:
        stats = self.metadata_store.get_resource_stats()
        stats["vector_documents_count"] = self.vector_store.count_documents()
        return stats

    def get_audio_overview(self, notebook_id: str) -> dict[str, Any] | None:
        return self.metadata_store.get_latest_audio_overview(notebook_id)

    def process_audio_overview_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        notebook_id = str(payload.get("notebook_id") or "").strip()
        inline_content = str(payload.get("content") or "").strip()
        if not notebook_id and not inline_content:
            raise ValueError("Either notebook_id or content is required for audio overview generation")

        job_id = str(payload.get("_job_id") or "")
        briefing = str(payload.get("briefing") or "").strip()
        provider = payload.get("provider")
        model = payload.get("model")
        temperature = float(payload.get("temperature") or 0.3)

        if job_id and notebook_id:
            self.metadata_store.upsert_audio_overview(
                notebook_id=notebook_id,
                job_id=job_id,
                status="running",
            )

        try:
            if inline_content:
                context = inline_content
            else:
                linked_source_ids = sorted(self.metadata_store.list_source_ids(notebook_id))
                if not linked_source_ids:
                    raise ValueError("No linked sources found for this notebook")

                sources = self.metadata_store.list_sources(
                    notebook_id=notebook_id,
                    source_ids=linked_source_ids,
                )
                context = self._build_audio_context(sources)

            script = self._generate_audio_script(
                context=context,
                briefing=briefing,
                provider=provider,
                model=model,
                temperature=temperature,
            )

            if not script:
                raise ValueError("Generated audio script is empty")

            rendered_audio_parts: list[Path] = []
            speaker_slots = _build_speaker_slots(script)

            for turn in script:
                dialogue = str(turn.get("dialogue") or "").strip()
                if not dialogue:
                    continue

                speaker_name = str(turn.get("speaker") or "Speaker 1")
                slot = speaker_slots.get(speaker_name, "speaker_1")
                part = self.speech_service.synthesize(
                    text=dialogue,
                    speaker=slot,
                )
                rendered_audio_parts.append(part)

            if not rendered_audio_parts:
                raise ValueError("No audio segments were generated from the script")

            output_key = notebook_id if notebook_id else "adhoc"
            merged_audio = self.speech_service.merge_audio_files(
                rendered_audio_parts,
                output_name=f"audio_overview_{output_key}_{uuid4().hex}.mp3",
            )

            result = {
                "notebook_id": notebook_id,
                "job_id": job_id,
                "status": "completed",
                "audio_path": str(merged_audio),
                "script": script,
            }

            if job_id and notebook_id:
                self.metadata_store.upsert_audio_overview(
                    notebook_id=notebook_id,
                    job_id=job_id,
                    status="completed",
                    script=script,
                    audio_path=str(merged_audio),
                )

            return result
        except Exception as exc:
            if job_id and notebook_id:
                self.metadata_store.upsert_audio_overview(
                    notebook_id=notebook_id,
                    job_id=job_id,
                    status="failed",
                    error=str(exc),
                )
            raise

    def _create_source(
        self,
        *,
        notebook_id: str,
        title: str,
        source_type: str,
        origin: str | None,
        content: str,
        embed: bool,
    ) -> dict[str, Any]:
        notebook = self.metadata_store.get_notebook(notebook_id)
        if notebook is None:
            raise ValueError(f"Notebook '{notebook_id}' not found")

        if not content.strip():
            raise ValueError("Source content is empty")

        if len(content) > self.settings.max_source_characters:
            raise ValueError(
                "Source content exceeds configured max_source_characters limit"
            )

        source = self.metadata_store.create_source(
            notebook_id=notebook_id,
            title=title,
            source_type=source_type,
            origin=origin,
            content=content,
        )

        chunk_count = 0
        if embed:
            chunk_count = self.vector_store.upsert_source(
                source_id=source["id"],
                notebook_id=notebook_id,
                title=title,
                text=content,
                chunk_size=self.settings.default_chunk_size,
                chunk_overlap=self.settings.default_chunk_overlap,
            )
            self.metadata_store.update_source_chunk_count(source["id"], chunk_count)

        source["chunk_count"] = chunk_count
        return source

    def _build_audio_context(self, sources: list[dict[str, Any]]) -> str:
        parts: list[str] = []
        total_chars = 0
        max_chars = 24_000

        for source in sources:
            title = str(source.get("title") or "Untitled Source")
            content = str(source.get("content") or "").strip()
            if not content:
                continue

            block = f"Source: {title}\n{content}\n"
            if total_chars + len(block) > max_chars:
                remaining = max_chars - total_chars
                if remaining <= 0:
                    break
                block = block[:remaining]

            parts.append(block)
            total_chars += len(block)

            if total_chars >= max_chars:
                break

        return "\n\n".join(parts).strip()

    def _generate_audio_script(
        self,
        *,
        context: str,
        briefing: str,
        provider: str | None,
        model: str | None,
        temperature: float,
    ) -> list[dict[str, str]]:
        system_prompt = self._get_prompt_template(
            name="audio_overview_script_system",
            fallback=(
                "You are an AI assistant specialized in creating podcast transcripts. "
                "Generate a concise and engaging two-speaker educational discussion. "
                "Use only facts supported by the provided context. "
                "Output strict JSON with this shape: "
                "{\"transcript\": [{\"speaker\": \"Speaker 1\", \"dialogue\": \"...\"}, "
                "{\"speaker\": \"Speaker 2\", \"dialogue\": \"...\"}]}. "
                "Do not wrap output in markdown code fences."
            ),
        )
        user_template = self._get_prompt_template(
            name="audio_overview_script_user",
            fallback=(
                "Briefing:\n{briefing}\n\n"
                "Context:\n{context}\n\n"
                "Create a natural 10-16 turn dialogue between Speaker 1 and Speaker 2. "
                "Keep each turn to 1-3 short sentences. "
                "Prioritize clarity, key insights, and practical takeaways. "
                "Return only the JSON object."
            ),
        )

        try:
            model_client = self.llm_manager.get_chat_model(
                provider=provider,
                model=model,
                temperature=temperature,
            )

            user_prompt = user_template.format(
                briefing=(briefing or "Create a concise overview based on the notebook."),
                context=context or "No context provided.",
            )
            response = model_client.invoke(
                [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt),
                ]
            )
            response_text = _extract_text(response.content)

            script = _parse_audio_script(response_text)
            if script:
                return script
        except Exception:
            # Keep audio generation usable when local/remote LLM endpoint is unavailable.
            pass

        return _fallback_audio_script(context, briefing=briefing)

    def _get_prompt_template(self, *, name: str, fallback: str) -> str:
        prompt = self.metadata_store.get_prompt_template(name)
        if prompt and prompt.get("content"):
            return str(prompt["content"])
        return fallback

    def _validate_file_resource(self, file_path: Path) -> None:
        if not file_path.exists():
            raise ValueError(f"File does not exist: {file_path}")

        extension = file_path.suffix.lower()
        if extension not in self.settings.allowed_upload_extensions():
            raise ValueError(
                f"Unsupported file extension '{extension}'. "
                "Update allowed_upload_extensions_csv to permit this type."
            )

        file_size = file_path.stat().st_size
        if file_size > self.settings.max_upload_bytes():
            raise ValueError(
                "File exceeds configured max_upload_mb limit"
            )


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


def _parse_audio_script(response_text: str) -> list[dict[str, str]]:
    candidate = response_text.strip()
    candidate = re.sub(r"^```(?:json)?\s*", "", candidate)
    candidate = re.sub(r"\s*```$", "", candidate)

    parsed: Any
    try:
        parsed = json.loads(candidate)
    except Exception:
        json_match = re.search(r"\{.*\}", candidate, re.DOTALL)
        if not json_match:
            return []
        try:
            parsed = json.loads(json_match.group(0))
        except Exception:
            return []

    transcript: Any
    if isinstance(parsed, dict):
        transcript = parsed.get("transcript")
    else:
        transcript = parsed

    if not isinstance(transcript, list):
        return []

    cleaned: list[dict[str, str]] = []
    for row in transcript:
        if not isinstance(row, dict):
            continue
        speaker = str(row.get("speaker") or "").strip()
        dialogue = str(row.get("dialogue") or "").strip()
        if not dialogue:
            continue
        if not speaker:
            speaker = "Speaker 1"
        cleaned.append({"speaker": speaker, "dialogue": dialogue})

    return cleaned[:40]


def _fallback_audio_script(context: str, briefing: str = "") -> list[dict[str, str]]:
    sections = _extract_source_sections(context)

    if not sections:
        sections = [("Notebook Source", "No source content was available for this notebook.")]

    script: list[dict[str, str]] = [
        {
            "speaker": "Speaker 1",
            "dialogue": (
                "Here is an audio overview grounded in your notebook sources. "
                + (f"Focus: {briefing.strip()}" if briefing.strip() else "")
            ).strip(),
        }
    ]

    for idx, (title, content) in enumerate(sections[:6]):
        excerpt = _first_sentences(content, max_sentences=2, max_chars=280)
        speaker = "Speaker 2" if idx % 2 == 0 else "Speaker 1"
        script.append(
            {
                "speaker": speaker,
                "dialogue": f"From {title}: {excerpt}",
            }
        )

    script.append(
        {
            "speaker": "Speaker 2",
            "dialogue": "That summarizes the key points from the current notebook sources.",
        }
    )

    return script[:12]


def _extract_source_sections(context: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    current_title = "Notebook Source"
    current_lines: list[str] = []

    for line in context.splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        if stripped.startswith("Source:"):
            if current_lines:
                sections.append((current_title, " ".join(current_lines).strip()))
                current_lines = []
            current_title = stripped.split(":", 1)[1].strip() or "Notebook Source"
            continue

        current_lines.append(stripped)

    if current_lines:
        sections.append((current_title, " ".join(current_lines).strip()))

    return sections


def _first_sentences(text: str, max_sentences: int = 2, max_chars: int = 280) -> str:
    cleaned = " ".join(part for part in text.split() if part)
    if not cleaned:
        return "No additional details were available."

    pieces = re.split(r"(?<=[.!?])\s+", cleaned)
    selected = " ".join(pieces[:max_sentences]).strip()
    if not selected:
        selected = cleaned

    if len(selected) > max_chars:
        selected = selected[:max_chars].rstrip() + "..."

    return selected


def _build_speaker_slots(script: list[dict[str, str]]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    ordered_speakers: list[str] = []

    for row in script:
        name = str(row.get("speaker") or "Speaker 1").strip()
        if name and name not in ordered_speakers:
            ordered_speakers.append(name)

    for idx, name in enumerate(ordered_speakers[:2]):
        mapping[name] = "speaker_1" if idx == 0 else "speaker_2"

    if ordered_speakers and ordered_speakers[0] not in mapping:
        mapping[ordered_speakers[0]] = "speaker_1"

    return mapping
