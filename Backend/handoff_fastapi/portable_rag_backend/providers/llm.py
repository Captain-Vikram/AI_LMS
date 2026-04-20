from __future__ import annotations

from langchain_core.language_models.chat_models import BaseChatModel
from pydantic import SecretStr

from portable_rag_backend.config import PortableRAGSettings
from portable_rag_backend.providers.lmstudio import (
    auto_detect_lmstudio_chat_model,
    is_placeholder_model_name,
)


_SUPPORTED_CHAT_PROVIDERS = {"local", "gemini", "lmstudio"}


class LLMProviderManager:
    """Minimal model factory supporting local, Gemini, and LM Studio chat models."""

    def __init__(self, settings: PortableRAGSettings):
        self.settings = settings
        self._resolved_lmstudio_chat_model: str | None = None

    def normalize_provider_name(self, provider: str | None) -> str:
        raw = (provider or "").strip().lower()
        if not raw:
            return self.settings.default_chat_provider
        if raw == "google":
            return "gemini"
        return raw

    def get_chat_provider_candidates(self, preferred_provider: str | None = None) -> list[str]:
        preferred = self.normalize_provider_name(preferred_provider)
        candidates: list[str] = []

        def _append(provider_name: str | None) -> None:
            normalized = self.normalize_provider_name(provider_name)
            if normalized not in _SUPPORTED_CHAT_PROVIDERS:
                return
            if normalized == "gemini" and not self.settings.google_api_key:
                return
            if normalized not in candidates:
                candidates.append(normalized)

        _append(preferred)
        _append("lmstudio")

        if self.settings.enable_cloud_llm_fallback:
            _append(self.settings.llm_fallback_provider)
            _append("gemini")

        _append("local")

        # Ensure all supported providers are still considered once, even if custom
        # fallback settings are incomplete.
        _append("lmstudio")
        _append("gemini")
        _append("local")

        if candidates:
            return candidates

        if preferred in _SUPPORTED_CHAT_PROVIDERS:
            return [preferred]
        return [self.settings.default_chat_provider]

    def resolve_chat_model(
        self,
        *,
        provider: str | None = None,
        model: str | None = None,
    ) -> str:
        active_provider = self.normalize_provider_name(provider)

        if active_provider == "local":
            return (model or self.settings.local_llm_model).strip()

        if active_provider == "gemini":
            return (model or self.settings.gemini_chat_model).strip()

        if active_provider == "lmstudio":
            requested_model = (model or "").strip()
            if requested_model and not is_placeholder_model_name(requested_model):
                return requested_model

            configured_model = (self.settings.lmstudio_chat_model or "").strip()
            if configured_model and not is_placeholder_model_name(configured_model):
                return configured_model

            if self._resolved_lmstudio_chat_model:
                return self._resolved_lmstudio_chat_model

            detected = auto_detect_lmstudio_chat_model(
                base_url=self.settings.lmstudio_base_url,
                api_key=self.settings.lmstudio_api_key,
            )
            self._resolved_lmstudio_chat_model = detected
            return detected

        raise ValueError(
            f"Unsupported provider '{active_provider}'. Supported: local, gemini, lmstudio"
        )

    def get_chat_model(
        self,
        provider: str | None = None,
        model: str | None = None,
        temperature: float = 0.2,
    ) -> BaseChatModel:
        active_provider = self.normalize_provider_name(provider)
        resolved_model = self.resolve_chat_model(provider=active_provider, model=model)

        if active_provider == "local":
            from langchain_ollama import ChatOllama

            return ChatOllama(
                model=resolved_model,
                base_url=self.settings.local_llm_base_url,
                temperature=temperature,
            )

        if active_provider == "gemini":
            if not self.settings.google_api_key:
                raise ValueError(
                    "GOOGLE_API_KEY is required when default_chat_provider=gemini"
                )

            from langchain_google_genai import ChatGoogleGenerativeAI

            return ChatGoogleGenerativeAI(
                model=resolved_model,
                google_api_key=self.settings.google_api_key,
                temperature=temperature,
            )

        if active_provider == "lmstudio":
            from langchain_openai import ChatOpenAI

            return ChatOpenAI(
                model=resolved_model,
                base_url=self.settings.lmstudio_base_url,
                api_key=SecretStr(self.settings.lmstudio_api_key or "lm-studio"),
                temperature=temperature,
            )

        raise ValueError(
            f"Unsupported provider '{active_provider}'. Supported: local, gemini, lmstudio"
        )
