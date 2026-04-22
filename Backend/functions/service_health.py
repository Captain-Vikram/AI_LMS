import os
from datetime import datetime, timezone
from typing import Any, Dict

import requests

from database import client as mongo_client
from functions.llm_adapter import (
    DEFAULT_GOOGLE_BASE_URL,
    DEFAULT_GOOGLE_MODEL,
    cloud_fallback_enabled,
    cloud_fallback_ready,
    get_base_url,
    get_cloud_fallback_provider,
)


def _utc_iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _probe_mongodb() -> Dict[str, Any]:
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")

    try:
        mongo_client.admin.command("ping")
        return {
            "status": "up",
            "message": "MongoDB is reachable",
            "uri": mongo_uri,
        }
    except Exception as exc:
        return {
            "status": "down",
            "message": "MongoDB is unavailable. Check Docker/service and MONGO_URI.",
            "uri": mongo_uri,
            "error": str(exc),
        }


def _probe_lmstudio(timeout_seconds: int = 2) -> Dict[str, Any]:
    base_url = get_base_url()
    probe_errors = []

    for path in ("/api/v1/models", "/v1/models"):
        try:
            response = requests.get(f"{base_url}{path}", timeout=timeout_seconds)

            if response.status_code < 500:
                return {
                    "status": "up",
                    "message": "LM Studio is reachable",
                    "base_url": base_url,
                }

            probe_errors.append(f"{path}: HTTP {response.status_code}")
        except requests.RequestException as exc:
            probe_errors.append(f"{path}: {exc.__class__.__name__}: {exc}")

    return {
        "status": "down",
        "message": "LM Studio is unavailable. Ensure LM Studio app is running and model is loaded.",
        "base_url": base_url,
        "error": " | ".join(probe_errors),
    }


def _probe_vector_db_optional(timeout_seconds: int = 2) -> Dict[str, Any]:
    base_url = (os.getenv("VECTOR_DB_API_BASE_URL") or "").strip().rstrip("/")
    if not base_url:
        return {
            "status": "disabled",
            "message": "External vector DB probe is disabled (VECTOR_DB_API_BASE_URL not set).",
            "base_url": "",
        }

    probe_errors = []
    for path in ("/health", "/status", "/"):
        try:
            response = requests.get(f"{base_url}{path}", timeout=timeout_seconds)
            if response.status_code < 500:
                return {
                    "status": "up",
                    "message": "External vector DB endpoint is reachable.",
                    "base_url": base_url,
                    "probe_path": path,
                    "status_code": response.status_code,
                }
            probe_errors.append(f"{path}: HTTP {response.status_code}")
        except requests.RequestException as exc:
            probe_errors.append(f"{path}: {exc.__class__.__name__}: {exc}")

    return {
        "status": "degraded",
        "message": "External vector DB endpoint is configured but currently unreachable.",
        "base_url": base_url,
        "error": " | ".join(probe_errors),
    }


def _probe_external_api_config() -> Dict[str, Any]:
    required_keys = [
        "GOOGLE_API_KEY",
        "TAVILY_API_KEY",
        "SERPER_API_KEY",
        "DEEPGRAM_API_KEY",
        "GROQ_API_KEY",
    ]
    missing_keys = [key for key in required_keys if not os.getenv(key)]

    if missing_keys:
        return {
            "status": "degraded",
            "message": "Some external API keys are missing; related features may fail.",
            "missing_keys": missing_keys,
        }

    return {
        "status": "up",
        "message": "External API key configuration looks good",
        "missing_keys": [],
    }


def _probe_cloud_llm_fallback() -> Dict[str, Any]:
    provider = get_cloud_fallback_provider()
    enabled = cloud_fallback_enabled()

    if not enabled:
        return {
            "status": "disabled",
            "provider": provider,
            "message": "Cloud LLM fallback is disabled by configuration.",
        }

    if provider not in {"groq", "google"}:
        return {
            "status": "down",
            "provider": provider,
            "message": "Unsupported cloud fallback provider configured.",
        }

    if not cloud_fallback_ready():
        return {
            "status": "down",
            "provider": provider,
            "message": "Cloud LLM fallback is enabled but not ready. Configure fallback API credentials.",
        }

    if provider == "groq":
        api_key = (os.getenv("GROQ_API_KEY") or "").strip()
        base_url = (os.getenv("GROQ_BASE_URL") or "https://api.groq.com/openai/v1").rstrip("/")

        try:
            response = requests.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=2,
            )

            if response.status_code in (401, 403):
                return {
                    "status": "down",
                    "provider": provider,
                    "message": "Cloud fallback API key is invalid.",
                }

            if response.status_code >= 400:
                return {
                    "status": "down",
                    "provider": provider,
                    "message": f"Cloud fallback probe failed with HTTP {response.status_code}.",
                }

            return {
                "status": "up",
                "provider": provider,
                "message": "Cloud LLM fallback is configured and ready.",
            }
        except requests.RequestException as exc:
            return {
                "status": "down",
                "provider": provider,
                "message": "Cloud fallback provider is unreachable.",
                "error": f"{exc.__class__.__name__}: {exc}",
            }

    # Google fallback probe
    api_key = (os.getenv("GOOGLE_API_KEY") or "").strip()
    base_url = (os.getenv("GOOGLE_GENERATIVE_BASE_URL") or DEFAULT_GOOGLE_BASE_URL).rstrip("/")
    configured_model = (
        (os.getenv("LLM_FALLBACK_MODEL") or "").strip()
        or (os.getenv("GOOGLE_FALLBACK_MODEL") or "").strip()
        or (os.getenv("GOOGLE_MODEL") or "").strip()
        or DEFAULT_GOOGLE_MODEL
    )
    normalized_model = configured_model if configured_model.startswith("models/") else f"models/{configured_model}"

    try:
        response = requests.get(
            f"{base_url}/models",
            params={"key": api_key},
            timeout=2,
        )

        if response.status_code in (401, 403):
            return {
                "status": "down",
                "provider": provider,
                "message": "Google fallback API key is invalid.",
            }

        if response.status_code >= 400:
            return {
                "status": "down",
                "provider": provider,
                "message": f"Google fallback probe failed with HTTP {response.status_code}.",
            }

        payload = response.json() if response.content else {}
        available_models = {
            item.get("name")
            for item in (payload.get("models") or [])
            if isinstance(item, dict) and item.get("name")
        }

        if available_models and normalized_model not in available_models:
            return {
                "status": "degraded",
                "provider": provider,
                "message": f"Google fallback key is valid, but configured model '{configured_model}' is not listed.",
                "configured_model": configured_model,
            }

        return {
            "status": "up",
            "provider": provider,
            "message": "Google fallback is configured and ready.",
            "configured_model": configured_model,
        }
    except requests.RequestException as exc:
        return {
            "status": "down",
            "provider": provider,
            "message": "Google fallback provider is unreachable.",
            "error": f"{exc.__class__.__name__}: {exc}",
        }


def get_dependency_health_snapshot() -> Dict[str, Any]:
    mongodb = _probe_mongodb()
    lmstudio = _probe_lmstudio()
    vector_db = _probe_vector_db_optional()
    external_apis = _probe_external_api_config()
    cloud_llm_fallback = _probe_cloud_llm_fallback()

    mongodb_down = mongodb["status"] == "down"
    lmstudio_down = lmstudio["status"] == "down"
    fallback_up = cloud_llm_fallback["status"] == "up"
    external_degraded = external_apis["status"] == "degraded"
    fallback_degraded = cloud_llm_fallback["status"] == "down"
    vector_degraded = vector_db["status"] in {"down", "degraded"}

    if mongodb_down:
        overall_status = "down"
    elif lmstudio_down and not fallback_up:
        overall_status = "down"
    elif external_degraded or (lmstudio_down and fallback_up) or fallback_degraded or vector_degraded:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    return {
        "status": overall_status,
        "timestamp": _utc_iso_now(),
        "dependencies": {
            "mongodb": mongodb,
            "lmstudio": lmstudio,
            "vector_db": vector_db,
            "external_apis": external_apis,
            "cloud_llm_fallback": cloud_llm_fallback,
        },
    }
