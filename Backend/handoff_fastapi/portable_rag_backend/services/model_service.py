from __future__ import annotations

from portable_rag_backend.config import PortableRAGSettings


class ModelService:
    def __init__(self, *, settings: PortableRAGSettings):
        self.settings = settings

    def get_model_info(self) -> dict[str, object]:
        return {
            "default_chat_provider": self.settings.default_chat_provider,
            "default_embedding_provider": self.settings.default_embedding_provider,
            "local": {
                "chat_model": self.settings.local_llm_model,
                "embedding_model": self.settings.local_embedding_model,
                "base_url": self.settings.local_llm_base_url,
            },
            "lmstudio": {
                "chat_model": self.settings.lmstudio_chat_model,
                "embedding_model": self.settings.lmstudio_embedding_model,
                "base_url": self.settings.lmstudio_base_url,
                "api_key_configured": bool(self.settings.lmstudio_api_key),
            },
            "gemini": {
                "chat_model": self.settings.gemini_chat_model,
                "embedding_model": self.settings.gemini_embedding_model,
                "api_key_configured": bool(self.settings.google_api_key),
            },
            "speech": {
                "stt_provider": self.settings.stt_provider,
                "stt_model": self.settings.whisper_model_size,
                "deepgram_stt_model": self.settings.deepgram_stt_model,
                "deepgram_api_key_configured": bool(self.settings.deepgram_api_key),
                "tts_language": self.settings.tts_language,
            },
        }
