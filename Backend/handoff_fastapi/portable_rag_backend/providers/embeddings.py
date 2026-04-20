from __future__ import annotations

from langchain_core.embeddings import Embeddings

from portable_rag_backend.config import PortableRAGSettings
from portable_rag_backend.providers.lmstudio import (
    is_placeholder_model_name,
    list_lmstudio_embedding_models,
)


class EmbeddingProviderManager:
    """Embedding factory supporting local, Gemini, and LM Studio providers."""

    def __init__(self, settings: PortableRAGSettings):
        self.settings = settings
        self._cache: dict[str, Embeddings] = {}
        self._resolved_lmstudio_embedding_model: str | None = None
        self._detected_lmstudio_embedding_models: list[str] = []

    def resolve_embedding_model(
        self,
        *,
        provider: str | None = None,
        model: str | None = None,
    ) -> str:
        active_provider = provider or self.settings.default_embedding_provider

        if active_provider == "local":
            return (model or self.settings.local_embedding_model).strip()

        if active_provider == "gemini":
            return (model or self.settings.gemini_embedding_model).strip()

        if active_provider == "lmstudio":
            requested_model = (model or "").strip()
            if requested_model and not is_placeholder_model_name(requested_model):
                return requested_model

            configured_model = (self.settings.lmstudio_embedding_model or "").strip()
            if configured_model and not is_placeholder_model_name(configured_model):
                return configured_model

            if self._resolved_lmstudio_embedding_model:
                return self._resolved_lmstudio_embedding_model

            candidates = list_lmstudio_embedding_models(
                base_url=self.settings.lmstudio_base_url,
                api_key=self.settings.lmstudio_api_key,
            )
            self._detected_lmstudio_embedding_models = candidates
            if not candidates:
                raise ValueError(
                    "LM Studio returned no embedding candidates. Load at least one embedding model."
                )

            self._resolved_lmstudio_embedding_model = candidates[0]
            return candidates[0]

        raise ValueError(
            f"Unsupported embedding provider '{active_provider}'. Supported: local, gemini, lmstudio"
        )

    def get_embeddings(self, provider: str | None = None) -> Embeddings:
        active_provider = provider or self.settings.default_embedding_provider
        resolved_model = self.resolve_embedding_model(provider=active_provider)
        cache_key = f"{active_provider}:{resolved_model}"

        if cache_key in self._cache:
            return self._cache[cache_key]

        if active_provider == "local":
            from langchain_huggingface import HuggingFaceEmbeddings

            embeddings = HuggingFaceEmbeddings(
                model_name=resolved_model,
                model_kwargs={"device": "cpu"},
            )
            self._cache[cache_key] = embeddings
            return embeddings

        if active_provider == "gemini":
            if not self.settings.google_api_key:
                raise ValueError(
                    "GOOGLE_API_KEY is required when default_embedding_provider=gemini"
                )

            from langchain_google_genai import GoogleGenerativeAIEmbeddings

            embeddings = GoogleGenerativeAIEmbeddings(
                model=resolved_model,
                google_api_key=self.settings.google_api_key,
            )
            self._cache[cache_key] = embeddings
            return embeddings

        if active_provider == "lmstudio":
            from langchain_openai import OpenAIEmbeddings

            embeddings = OpenAIEmbeddings(
                model=resolved_model,
                base_url=self.settings.lmstudio_base_url,
                api_key=self.settings.lmstudio_api_key or "lm-studio",
                # LM Studio embeddings endpoint expects raw strings in `input`.
                # Disabling tiktoken-based length checks avoids sending token arrays.
                tiktoken_enabled=False,
                check_embedding_ctx_length=False,
            )
            self._cache[cache_key] = embeddings
            return embeddings

        raise ValueError(
            f"Unsupported embedding provider '{active_provider}'. Supported: local, gemini, lmstudio"
        )

    def signature(self, provider: str | None = None) -> str:
        active_provider = provider or self.settings.default_embedding_provider
        if active_provider == "local":
            return f"local:{self.resolve_embedding_model(provider=active_provider)}"
        if active_provider == "gemini":
            return f"gemini:{self.resolve_embedding_model(provider=active_provider)}"
        if active_provider == "lmstudio":
            return f"lmstudio:{self.resolve_embedding_model(provider=active_provider)}"
        return active_provider

    def get_lmstudio_embedding_candidates(self) -> list[str]:
        if self._detected_lmstudio_embedding_models:
            return list(self._detected_lmstudio_embedding_models)

        candidates = list_lmstudio_embedding_models(
            base_url=self.settings.lmstudio_base_url,
            api_key=self.settings.lmstudio_api_key,
        )
        self._detected_lmstudio_embedding_models = candidates
        return list(candidates)
