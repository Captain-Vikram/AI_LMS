from __future__ import annotations

from dataclasses import dataclass

from portable_rag_backend.config import PortableRAGSettings, get_settings
from portable_rag_backend.jobs import JobManager
from portable_rag_backend.providers.embeddings import EmbeddingProviderManager
from portable_rag_backend.providers.llm import LLMProviderManager
from portable_rag_backend.providers.speech import SpeechService
from portable_rag_backend.services.chat_service import ChatService
from portable_rag_backend.services.model_service import ModelService
from portable_rag_backend.services.source_service import SourceService
from portable_rag_backend.storage.metadata import MetadataStore
from portable_rag_backend.storage.vector_store import PortableVectorStore


@dataclass
class PortableRAGBackend:
    settings: PortableRAGSettings
    metadata_store: MetadataStore
    vector_store: PortableVectorStore
    llm_manager: LLMProviderManager
    embedding_manager: EmbeddingProviderManager
    speech_service: SpeechService
    source_service: SourceService
    chat_service: ChatService
    model_service: ModelService
    job_manager: JobManager


def create_backend(settings: PortableRAGSettings | None = None) -> PortableRAGBackend:
    active_settings = settings or get_settings()

    metadata_store = MetadataStore(active_settings.resolve_sqlite_path())
    embedding_manager = EmbeddingProviderManager(active_settings)
    vector_store = PortableVectorStore(
        persist_directory=active_settings.resolve_vector_dir(),
        collection_name=active_settings.vector_collection_name,
        embedding_manager=embedding_manager,
    )
    llm_manager = LLMProviderManager(active_settings)
    speech_service = SpeechService(active_settings)

    source_service = SourceService(
        settings=active_settings,
        metadata_store=metadata_store,
        vector_store=vector_store,
        llm_manager=llm_manager,
        speech_service=speech_service,
    )
    chat_service = ChatService(
        settings=active_settings,
        metadata_store=metadata_store,
        vector_store=vector_store,
        llm_manager=llm_manager,
    )
    model_service = ModelService(settings=active_settings)
    job_manager = JobManager(
        metadata_store=metadata_store,
        max_workers=active_settings.job_worker_count,
    )
    job_manager.register_handler("source_ingestion", source_service.process_ingestion_job)
    job_manager.register_handler("vector_rebuild", source_service.process_vector_rebuild_job)
    job_manager.register_handler("audio_overview_generation", source_service.process_audio_overview_job)

    return PortableRAGBackend(
        settings=active_settings,
        metadata_store=metadata_store,
        vector_store=vector_store,
        llm_manager=llm_manager,
        embedding_manager=embedding_manager,
        speech_service=speech_service,
        source_service=source_service,
        chat_service=chat_service,
        model_service=model_service,
        job_manager=job_manager,
    )
