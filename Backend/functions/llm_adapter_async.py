"""
Async HTTP client wrapper for LLM operations.
Provides async versions of llm_adapter functions using httpx.
"""

import json
import os
from types import SimpleNamespace
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv

# Import all constants and helper functions from sync adapter
from functions.llm_adapter import (
    DEFAULT_LMSTUDIO_URL,
    DEFAULT_GROQ_BASE_URL,
    DEFAULT_GROQ_MODEL,
    DEFAULT_GOOGLE_BASE_URL,
    DEFAULT_GOOGLE_MODEL,
    AUTO_MODEL_SENTINELS,
    _is_truthy,
    _resolve_timeout,
    cloud_fallback_enabled,
    get_cloud_fallback_provider,
    cloud_fallback_ready,
    get_base_url,
    get_default_model,
    _extract_model_id,
    _extract_models_list,
    _extract_text,
    _build_headers,
    _normalize_messages,
    _build_chat_payload,
    _build_responses_payload,
    _normalize_google_model_name,
    _messages_to_google_contents,
    resolve_model_name,
)

load_dotenv(override=True)


async def _detect_model_id_async(timeout: int = 15) -> Optional[str]:
    """Async version of model detection"""
    base_url = get_base_url()
    headers = _build_headers()

    async with httpx.AsyncClient(timeout=timeout) as client:
        for path in ("/api/v1/models", "/v1/models"):
            url = f"{base_url}{path}"
            try:
                response = await client.get(url, headers=headers)
                if response.status_code >= 400:
                    continue

                data = response.json()
                models = _extract_models_list(data)

                # Pass 1: loaded model instances
                for model in models:
                    model_id = _extract_model_id(model, loaded_only=True)
                    if model_id:
                        return model_id

                # Pass 2: LLM models in registry
                for model in models:
                    model_id = _extract_model_id(model, llm_only=True)
                    if model_id:
                        return model_id

                # Pass 3: generic fallback
                for model in models:
                    model_id = _extract_model_id(model)
                    if model_id:
                        return model_id
            except Exception:
                continue

    return None


async def _generate_text_via_groq_async(
    messages: List[Dict[str, str]],
    generation_config: Dict[str, Any],
    timeout: int,
) -> str:
    """Async version of Groq fallback"""
    api_key = (os.getenv("GROQ_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    base_url = (os.getenv("GROQ_BASE_URL") or DEFAULT_GROQ_BASE_URL).rstrip("/")
    model = (
        (os.getenv("LLM_FALLBACK_MODEL") or "").strip()
        or (os.getenv("GROQ_MODEL") or "").strip()
        or DEFAULT_GROQ_MODEL
    )

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "temperature": generation_config.get("temperature", 0.2),
        "top_p": generation_config.get("top_p", 0.95),
    }

    max_tokens = generation_config.get("max_tokens", generation_config.get("max_output_tokens", 1024))
    if max_tokens is not None:
        payload["max_tokens"] = int(max_tokens)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

        if response.status_code >= 400:
            raise RuntimeError(f"Groq fallback failed with HTTP {response.status_code}: {response.text[:180]}")

        try:
            data = response.json()
        except ValueError:
            data = response.text

    text = _extract_text(data)
    if not text or not text.strip():
        raise RuntimeError("Groq fallback returned an empty response")

    return text


async def _generate_text_via_google_async(
    messages: List[Dict[str, str]],
    generation_config: Dict[str, Any],
    timeout: int,
) -> str:
    """Async version of Google fallback"""
    api_key = (os.getenv("GOOGLE_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is not configured")

    base_url = (os.getenv("GOOGLE_GENERATIVE_BASE_URL") or DEFAULT_GOOGLE_BASE_URL).rstrip("/")
    configured_model = (
        (os.getenv("LLM_FALLBACK_MODEL") or "").strip()
        or (os.getenv("GOOGLE_FALLBACK_MODEL") or "").strip()
        or (os.getenv("GOOGLE_MODEL") or "").strip()
        or (os.getenv("GEMINI_CHAT_MODEL") or "").strip()
        or DEFAULT_GOOGLE_MODEL
    )
    model = _normalize_google_model_name(configured_model)

    payload: Dict[str, Any] = {
        "contents": _messages_to_google_contents(messages),
    }

    generation_cfg: Dict[str, Any] = {
        "temperature": generation_config.get("temperature", 0.2),
        "topP": generation_config.get("top_p", 0.95),
    }

    max_tokens = generation_config.get("max_tokens", generation_config.get("max_output_tokens", 1024))
    if max_tokens is not None:
        generation_cfg["maxOutputTokens"] = int(max_tokens)

    payload["generationConfig"] = generation_cfg

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{base_url}/models/{model}:generateContent",
            params={"key": api_key},
            headers={"Content-Type": "application/json"},
            json=payload,
        )

        if response.status_code >= 400:
            raise RuntimeError(f"Google fallback failed with HTTP {response.status_code}: {response.text[:180]}")

        try:
            data = response.json()
        except ValueError:
            data = response.text

    text = _extract_text(data)
    if not text or not text.strip():
        raise RuntimeError("Google fallback returned an empty response")

    return text


async def generate_text_async(
    prompt_or_messages: Any,
    model_name: Optional[str] = None,
    generation_config: Optional[Dict[str, Any]] = None,
    timeout: Optional[int] = None,
) -> str:
    """
    Asynchronously generate text from a local LM Studio server.
    Falls back to cloud providers (Groq, Google) if configured.
    """
    generation_config = generation_config or {}
    messages = _normalize_messages(prompt_or_messages)
    resolved_model_name = resolve_model_name(model_name)
    effective_timeout = _resolve_timeout(
        explicit_timeout=timeout,
        env_var="LMSTUDIO_TIMEOUT_SECONDS",
        default_timeout=120,
    )

    chat_payload = _build_chat_payload(resolved_model_name, messages, generation_config)
    responses_payload = _build_responses_payload(resolved_model_name, messages, generation_config)

    base_url = get_base_url()
    headers = _build_headers()
    errors = []

    # Try different endpoint paths
    local_attempts = [
        ("/v1/chat/completions", chat_payload),
        ("/api/v1/chat/completions", chat_payload),
        ("/v1/responses", responses_payload),
        ("/api/v1/responses", responses_payload),
    ]

    async with httpx.AsyncClient(timeout=effective_timeout) as client:
        for path, request_payload in local_attempts:
            url = f"{base_url}{path}"
            try:
                response = await client.post(url, headers=headers, json=request_payload)
                if response.status_code >= 400:
                    errors.append(f"{path} -> HTTP {response.status_code}: {response.text[:180]}")
                    continue

                try:
                    data = response.json()
                except ValueError:
                    data = response.text

                text = _extract_text(data)
                if text:
                    return text

                errors.append(f"{path} -> Empty text response")
            except httpx.RequestError as exc:
                errors.append(f"{path} -> {exc.__class__.__name__}: {exc}")

    fallback_errors = []

    if cloud_fallback_enabled():
        provider = get_cloud_fallback_provider()
        fallback_timeout = _resolve_timeout(
            explicit_timeout=None,
            env_var="LLM_FALLBACK_TIMEOUT_SECONDS",
            default_timeout=45,
        )

        if provider == "groq":
            try:
                return await _generate_text_via_groq_async(
                    messages=messages,
                    generation_config=generation_config,
                    timeout=max(5, fallback_timeout),
                )
            except Exception as exc:
                fallback_errors.append(f"groq -> {exc}")
        elif provider == "google":
            try:
                return await _generate_text_via_google_async(
                    messages=messages,
                    generation_config=generation_config,
                    timeout=max(5, fallback_timeout),
                )
            except Exception as exc:
                fallback_errors.append(f"google -> {exc}")
        else:
            fallback_errors.append(f"Unsupported fallback provider: {provider}")
    else:
        fallback_errors.append("Cloud fallback disabled by ENABLE_CLOUD_LLM_FALLBACK")

    error_summary = "LM Studio request failed. Tried local endpoints with errors: " + " | ".join(errors)

    if fallback_errors:
        error_summary += " || Cloud fallback errors: " + " | ".join(fallback_errors)

    raise RuntimeError(error_summary)


async def list_models_async(timeout: int = 20) -> List[Dict[str, Any]]:
    """Asynchronously list available LLM models"""
    base_url = get_base_url()
    headers = _build_headers()
    errors = []

    async with httpx.AsyncClient(timeout=timeout) as client:
        for path in ("/api/v1/models", "/v1/models"):
            url = f"{base_url}{path}"
            try:
                response = await client.get(url, headers=headers)
                if response.status_code >= 400:
                    errors.append(f"{path} -> HTTP {response.status_code}")
                    continue

                data = response.json()
                models = _extract_models_list(data)
                if models:
                    return models
                errors.append(f"{path} -> empty models payload")
            except httpx.RequestError as exc:
                errors.append(f"{path} -> {exc.__class__.__name__}: {exc}")

    if errors:
        raise RuntimeError(
            "Unable to list LM Studio models from local server: " + " | ".join(errors)
        )

    return []


class GenerativeModelAsync:
    """
    Async version of GenerativeModel wrapper for compatibility
    with code that uses google.generativeai.GenerativeModel.
    """

    def __init__(self, model_name: Optional[str] = None, generation_config: Optional[Dict[str, Any]] = None):
        self.model_name = model_name
        self.generation_config = generation_config or {}

    async def generate_content(self, prompt: Any, generation_config: Optional[Dict[str, Any]] = None):
        """Asynchronously generate content"""
        merged_config = dict(self.generation_config)
        if generation_config:
            merged_config.update(generation_config)

        text = await generate_text_async(
            prompt_or_messages=prompt,
            model_name=self.model_name,
            generation_config=merged_config,
        )

        return SimpleNamespace(text=text)
