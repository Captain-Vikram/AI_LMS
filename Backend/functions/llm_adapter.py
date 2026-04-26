import json
import os
from types import SimpleNamespace
from typing import Any, Dict, List, Optional

import requests

DEFAULT_LMSTUDIO_URL = "http://127.0.0.1:1234"
DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"
DEFAULT_GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_GOOGLE_MODEL = "gemini-1.5-flash"
AUTO_MODEL_SENTINELS = {"", "auto", "default", "local-model"}

_runtime_config = {
    "base_url": None,
    "api_token": None,
}


def _is_truthy(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _resolve_timeout(explicit_timeout: Optional[int], env_var: str, default_timeout: int) -> int:
    if explicit_timeout is not None:
        try:
            return max(5, int(explicit_timeout))
        except (TypeError, ValueError):
            return max(5, default_timeout)

    try:
        return max(5, int(os.getenv(env_var, str(default_timeout))))
    except ValueError:
        return max(5, default_timeout)


def cloud_fallback_enabled() -> bool:
    return _is_truthy(os.getenv("ENABLE_CLOUD_LLM_FALLBACK", "true"))


def get_cloud_fallback_provider() -> str:
    provider = (os.getenv("LLM_FALLBACK_PROVIDER", "google") or "google").strip().lower()
    if provider == "gemini":
        return "google"
    return provider


def cloud_fallback_ready() -> bool:
    provider = get_cloud_fallback_provider()

    if not cloud_fallback_enabled():
        return False

    if provider == "groq":
        return bool(os.getenv("GROQ_API_KEY"))

    if provider == "google":
        return bool(os.getenv("GOOGLE_API_KEY"))

    return False


def configure(api_key: Optional[str] = None, base_url: Optional[str] = None, api_token: Optional[str] = None):
    """
    Compatibility shim for existing `genai.configure(...)` calls.

    - `api_key` is treated as optional LM Studio API token.
    - `base_url` can override `LMSTUDIO_URL` for runtime calls.
    """
    if base_url:
        _runtime_config["base_url"] = str(base_url).rstrip("/")

    if api_token:
        _runtime_config["api_token"] = api_token
    elif api_key:
        _runtime_config["api_token"] = api_key



def get_base_url() -> str:
    return (
        _runtime_config.get("base_url")
        or os.getenv("LMSTUDIO_URL")
        or DEFAULT_LMSTUDIO_URL
    ).rstrip("/")



def get_default_model() -> Optional[str]:
    configured = (os.getenv("LMSTUDIO_MODEL") or "").strip()
    if configured.lower() in AUTO_MODEL_SENTINELS:
        return None
    return configured


def _extract_model_id(model_payload: Any, loaded_only: bool = False, llm_only: bool = False) -> Optional[str]:
    if isinstance(model_payload, dict):
        model_type = str(model_payload.get("type") or "").lower()
        if llm_only and model_type and model_type != "llm":
            return None

        loaded_instances = model_payload.get("loaded_instances")
        if isinstance(loaded_instances, list):
            for instance in loaded_instances:
                if isinstance(instance, dict):
                    instance_id = instance.get("id") or instance.get("model")
                    if instance_id:
                        return str(instance_id)

        if loaded_only:
            return None

        if model_type and model_type != "llm":
            model_id = model_payload.get("id") or model_payload.get("name")
        else:
            model_id = (
                model_payload.get("id")
                or model_payload.get("name")
                or model_payload.get("key")
            )
        if model_id:
            return str(model_id)
    return None


def _extract_models_list(data: Any) -> List[Dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]

    if isinstance(data, dict):
        # Native LM Studio v1 format.
        models = data.get("models")
        if isinstance(models, list):
            return [item for item in models if isinstance(item, dict)]

        # OpenAI-compatible format.
        models = data.get("data")
        if isinstance(models, list):
            return [item for item in models if isinstance(item, dict)]

        # Some variants may nest model arrays under data.<group>.
        if isinstance(models, dict):
            collected: List[Dict[str, Any]] = []
            for value in models.values():
                if isinstance(value, list):
                    collected.extend(item for item in value if isinstance(item, dict))
            if collected:
                return collected

    return []


def _detect_model_id(timeout: int = 15) -> Optional[str]:
    base_url = get_base_url()
    headers = _build_headers()

    for path in ("/api/v1/models", "/v1/models"):
        url = f"{base_url}{path}"
        try:
            response = requests.get(url, headers=headers, timeout=timeout)
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


def resolve_model_name(model_name: Optional[str] = None) -> Optional[str]:
    requested = (model_name or "").strip()
    if requested and requested.lower() not in AUTO_MODEL_SENTINELS:
        return requested

    default_model = get_default_model()
    if default_model:
        return default_model

    return _detect_model_id()



def _build_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}

    token = (
        _runtime_config.get("api_token")
        or os.getenv("LMSTUDIO_API_TOKEN")
        or os.getenv("LMSTUDIO_API_KEY")
    )
    if token:
        headers["Authorization"] = f"Bearer {token}"

    return headers



def _normalize_messages(prompt_or_messages: Any) -> List[Dict[str, str]]:
    if isinstance(prompt_or_messages, list):
        normalized = []
        for item in prompt_or_messages:
            if isinstance(item, dict) and "role" in item and "content" in item:
                normalized.append({"role": str(item["role"]), "content": str(item["content"])})
            else:
                normalized.append({"role": "user", "content": str(item)})
        return normalized

    if isinstance(prompt_or_messages, dict):
        if "role" in prompt_or_messages and "content" in prompt_or_messages:
            return [{
                "role": str(prompt_or_messages["role"]),
                "content": str(prompt_or_messages["content"]),
            }]
        return [{"role": "user", "content": json.dumps(prompt_or_messages, ensure_ascii=True)}]

    return [{"role": "user", "content": str(prompt_or_messages)}]



def _extract_text(data: Any) -> str:
    if isinstance(data, str):
        return data

    if isinstance(data, dict):
        # Google Gemini generateContent shape
        candidates = data.get("candidates")
        if isinstance(candidates, list) and candidates:
            first_candidate = candidates[0]
            if isinstance(first_candidate, dict):
                content_block = first_candidate.get("content")
                if isinstance(content_block, dict):
                    parts = content_block.get("parts")
                    if isinstance(parts, list):
                        combined_parts = []
                        for part in parts:
                            if isinstance(part, dict):
                                text_part = part.get("text")
                                if isinstance(text_part, str):
                                    combined_parts.append(text_part)
                        if combined_parts:
                            return "".join(combined_parts)

        # OpenAI-compatible shape
        choices = data.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str):
                        return content
                    if isinstance(content, list):
                        parts = []
                        for chunk in content:
                            if isinstance(chunk, str):
                                parts.append(chunk)
                            elif isinstance(chunk, dict):
                                text = chunk.get("text") or chunk.get("content")
                                if text:
                                    parts.append(str(text))
                        if parts:
                            return "".join(parts)
                text = first.get("text")
                if isinstance(text, str):
                    return text

        # Native v1 or fallback keys
        for key in ("output_text", "text", "message", "response", "content"):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                return value

        output = data.get("output")
        if isinstance(output, list):
            parts = []
            for item in output:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    text = item.get("text") or item.get("content")
                    if text:
                        parts.append(str(text))
            if parts:
                return "".join(parts)

    return json.dumps(data, ensure_ascii=True)



def _build_chat_payload(model_name: Optional[str], messages: List[Dict[str, str]], generation_config: Dict[str, Any]) -> Dict[str, Any]:
    # Many OpenAI-compatible servers REQUIRE a 'model' field.
    effective_model = model_name or os.getenv("LMSTUDIO_MODEL") or "local-model"
    if effective_model.lower() in AUTO_MODEL_SENTINELS:
        effective_model = "local-model"

    payload: Dict[str, Any] = {
        "model": effective_model,
        "messages": messages,
        "stream": False,
        "temperature": generation_config.get("temperature", 0.2),
        "top_p": generation_config.get("top_p", 0.95),
    }

    max_tokens = generation_config.get("max_tokens", generation_config.get("max_output_tokens", 1024))
    if max_tokens is not None:
        payload["max_tokens"] = int(max_tokens)

    return payload


def _normalize_google_model_name(model_name: str) -> str:
    cleaned = (model_name or "").strip()
    if cleaned.startswith("models/"):
        cleaned = cleaned.split("models/", 1)[1]
    return cleaned


def _messages_to_google_contents(messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    contents: List[Dict[str, Any]] = []

    for message in messages:
        role = str(message.get("role", "user")).lower()
        content = str(message.get("content", "")).strip()

        if not content:
            continue

        google_role = "model" if role == "assistant" else "user"
        contents.append({
            "role": google_role,
            "parts": [{"text": content}],
        })

    if not contents:
        contents.append({"role": "user", "parts": [{"text": "Hello"}]})

    return contents


def _build_responses_payload(
    model_name: Optional[str],
    messages: List[Dict[str, str]],
    generation_config: Dict[str, Any],
) -> Dict[str, Any]:
    # Responses API requires `input`, not `messages`.
    input_text = "\n".join(
        f"{message.get('role', 'user')}: {message.get('content', '')}" for message in messages
    ).strip()

    effective_model = model_name or os.getenv("LMSTUDIO_MODEL") or "local-model"
    if effective_model.lower() in AUTO_MODEL_SENTINELS:
        effective_model = "local-model"

    payload: Dict[str, Any] = {
        "model": effective_model,
        "input": input_text,
        "temperature": generation_config.get("temperature", 0.2),
        "top_p": generation_config.get("top_p", 0.95),
    }

    max_tokens = generation_config.get("max_tokens", generation_config.get("max_output_tokens", 1024))
    if max_tokens is not None:
        payload["max_output_tokens"] = int(max_tokens)

    return payload


def _generate_text_via_groq(
    messages: List[Dict[str, str]],
    generation_config: Dict[str, Any],
    timeout: int,
) -> str:
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

    response = requests.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
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


def _generate_text_via_google(
    messages: List[Dict[str, str]],
    generation_config: Dict[str, Any],
    timeout: int,
) -> str:
    api_key = (os.getenv("GOOGLE_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is not configured")

    base_url = (os.getenv("GOOGLE_GENERATIVE_BASE_URL") or DEFAULT_GOOGLE_BASE_URL).rstrip("/")
    configured_model = (
        (os.getenv("LLM_FALLBACK_MODEL") or "").strip()
        or (os.getenv("GOOGLE_FALLBACK_MODEL") or "").strip()
        or (os.getenv("GOOGLE_MODEL") or "").strip()
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

    response = requests.post(
        f"{base_url}/models/{model}:generateContent",
        params={"key": api_key},
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=timeout,
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



def generate_text(
    prompt_or_messages: Any,
    model_name: Optional[str] = None,
    generation_config: Optional[Dict[str, Any]] = None,
    timeout: Optional[int] = None,
) -> str:
    """
    Generate text from a local LM Studio server.

    Tries OpenAI-compatible chat first, then the responses API format
    for LM Studio variants that require `input` payloads.
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

    # `/api/v1/chat` can reject `messages` with "'input' is required" on some LM Studio builds.
    local_attempts = [
        ("/v1/chat/completions", chat_payload),
        ("/api/v1/chat/completions", chat_payload),
        ("/v1/responses", responses_payload),
        ("/api/v1/responses", responses_payload),
    ]

    for path, request_payload in local_attempts:
        url = f"{base_url}{path}"
        try:
            response = requests.post(url, headers=headers, json=request_payload, timeout=effective_timeout)
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
        except requests.RequestException as exc:
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
                return _generate_text_via_groq(
                    messages=messages,
                    generation_config=generation_config,
                    timeout=max(5, fallback_timeout),
                )
            except Exception as exc:
                fallback_errors.append(f"groq -> {exc}")
        elif provider == "google":
            try:
                return _generate_text_via_google(
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



def list_models(timeout: int = 20) -> List[Dict[str, Any]]:
    base_url = get_base_url()
    headers = _build_headers()
    errors = []

    for path in ("/api/v1/models", "/v1/models"):
        url = f"{base_url}{path}"
        try:
            response = requests.get(url, headers=headers, timeout=timeout)
            if response.status_code >= 400:
                errors.append(f"{path} -> HTTP {response.status_code}")
                continue

            data = response.json()
            models = _extract_models_list(data)
            if models:
                return models
            errors.append(f"{path} -> empty models payload")
        except requests.RequestException as exc:
            errors.append(f"{path} -> {exc.__class__.__name__}: {exc}")

    if errors:
        raise RuntimeError(
            "Unable to list LM Studio models from local server: " + " | ".join(errors)
        )

    return []



class GenerativeModel:
    """
    Minimal compatibility wrapper for code that previously used
    `google.generativeai.GenerativeModel`.
    """

    def __init__(self, model_name: Optional[str] = None, generation_config: Optional[Dict[str, Any]] = None):
        self.model_name = model_name
        self.generation_config = generation_config or {}

    def generate_content(self, prompt: Any, generation_config: Optional[Dict[str, Any]] = None):
        merged_config = dict(self.generation_config)
        if generation_config:
            merged_config.update(generation_config)

        text = generate_text(
            prompt_or_messages=prompt,
            model_name=self.model_name,
            generation_config=merged_config,
        )

        return SimpleNamespace(text=text)
