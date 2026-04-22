from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class PortableRAGSettings(BaseSettings):
    """Runtime settings for the portable RAG backend module."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    portable_data_dir: str = Field(
        default="./data/portable_rag",
        description="Root path where SQLite DB, vector DB, and generated files are stored.",
    )
    sqlite_path: str | None = Field(
        default=None,
        description="Optional explicit SQLite file path. Defaults to portable_data_dir/metadata.db.",
    )
    vector_collection_name: str = Field(
        default="portable_rag_chunks",
        description="Collection name for the vector store.",
    )
    vector_db_api_base_url: str | None = Field(
        default=None,
        description=(
            "Optional external vector DB API base URL for deployment health visibility "
            "(for example http://localhost:18001)."
        ),
    )

    default_chunk_size: int = Field(default=1200, ge=200, le=4000)
    default_chunk_overlap: int = Field(default=180, ge=0, le=1000)
    default_retrieval_k: int = Field(default=6, ge=1, le=30)
    chat_history_window: int = Field(default=8, ge=1, le=50)

    default_chat_provider: Literal["local", "gemini", "lmstudio"] = Field(default="local")
    default_embedding_provider: Literal["local", "gemini", "lmstudio"] = Field(default="local")
    enable_cloud_llm_fallback: bool = Field(
        default=True,
        description=(
            "When true, automatically try a cloud fallback provider if the primary "
            "chat provider is unavailable."
        ),
    )
    llm_fallback_provider: str = Field(
        default="gemini",
        description="Preferred fallback chat provider (gemini/google, lmstudio, or local).",
    )
    llm_fallback_model: str | None = Field(
        default=None,
        description="Optional fallback model override used with llm_fallback_provider.",
    )

    local_llm_base_url: str = Field(default="http://localhost:11434")
    local_llm_model: str = Field(default="llama3.1:8b")
    local_embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2"
    )

    lmstudio_base_url: str = Field(
        default="http://localhost:1234/v1",
        description="LM Studio OpenAI-compatible base URL. Keep the /v1 suffix.",
    )
    lmstudio_api_key: str = Field(
        default="",
        description="Optional LM Studio API token when authentication is enabled; usually blank for local usage.",
    )
    lmstudio_chat_model: str = Field(
        default="auto",
        description="LM Studio chat model identifier. Use 'auto' to detect the first loaded chat-capable model.",
    )
    lmstudio_embedding_model: str = Field(
        default="auto",
        description="LM Studio embedding model identifier. Use 'auto' to detect a loaded embedding model.",
    )

    google_api_key: str | None = Field(default=None)
    gemini_chat_model: str = Field(default="gemini-1.5-flash")
    gemini_embedding_model: str = Field(default="text-embedding-004")

    # Optional remote Open Notebook API base URL. If set, portable backend will
    # forward podcast generation requests to the remote API instead of running
    # a local fallback job.
    remote_api_base_url: str | None = Field(
        default=None,
        description=(
            "Optional base URL for a remote Open Notebook API to forward podcast "
            "generation requests (e.g. http://localhost:5055)."
        ),
    )

    stt_provider: Literal["whisper", "deepgram", "auto"] = Field(
        default="auto",
        description=(
            "Speech-to-text provider selection. "
            "'auto' tries Whisper first, then Deepgram when configured."
        ),
    )
    deepgram_api_key: str | None = Field(
        default=None,
        description="Deepgram API key used for STT fallback.",
    )
    deepgram_stt_model: str = Field(
        default="nova-3",
        description="Deepgram STT model identifier.",
    )
    deepgram_base_url: str = Field(
        default="https://api.deepgram.com/v1",
        description="Deepgram API base URL for STT requests.",
    )

    whisper_model_size: str = Field(default="base")
    tts_language: str = Field(default="en")

    max_source_characters: int = Field(
        default=1_000_000,
        ge=1_000,
        description="Maximum allowed characters for a single source payload.",
    )
    max_upload_mb: int = Field(
        default=50,
        ge=1,
        le=1024,
        description="Maximum allowed upload size in MB.",
    )
    allowed_upload_extensions_csv: str = Field(
        default=(
            ".txt,.md,.csv,.json,.pdf,.docx,.html,.xml,.py,.js,.ts,"
            ".mp3,.wav,.m4a,.mp4,.mov,.mkv"
        ),
        description="Comma-separated list of allowed file extensions for uploads.",
    )

    default_chat_system_prompt: str = Field(
        default=(
            "You are a strictly grounded retrieval assistant. "
            "Use only information from the provided Context block. "
            "Every factual statement must include one or more inline citations "
            "using [n] where n matches a Context citation index. "
            "Do not invent facts. Do not invent citations. "
            "If context is insufficient, explicitly say what is missing."
        ),
        description="Fallback system prompt if no custom prompt template is configured.",
    )

    job_worker_count: int = Field(
        default=2,
        ge=1,
        le=16,
        description="Number of in-process worker threads for background jobs.",
    )

    def resolve_data_dir(self) -> Path:
        path = Path(self.portable_data_dir).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    def resolve_sqlite_path(self) -> Path:
        if self.sqlite_path:
            path = Path(self.sqlite_path).resolve()
            path.parent.mkdir(parents=True, exist_ok=True)
            return path
        return self.resolve_data_dir() / "metadata.db"

    def resolve_vector_dir(self) -> Path:
        path = self.resolve_data_dir() / "vector_store"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def resolve_vector_db_api_base_url(self) -> str | None:
        if not self.vector_db_api_base_url:
            return None
        return self.vector_db_api_base_url.strip().rstrip("/")

    def resolve_upload_dir(self) -> Path:
        path = self.resolve_data_dir() / "uploads"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def resolve_audio_dir(self) -> Path:
        path = self.resolve_data_dir() / "audio"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    def allowed_upload_extensions(self) -> set[str]:
        items = [part.strip().lower() for part in self.allowed_upload_extensions_csv.split(",")]
        cleaned = {item for item in items if item}
        normalized: set[str] = set()
        for item in cleaned:
            normalized.add(item if item.startswith(".") else f".{item}")
        return normalized


@lru_cache(maxsize=1)
def get_settings() -> PortableRAGSettings:
    return PortableRAGSettings()
