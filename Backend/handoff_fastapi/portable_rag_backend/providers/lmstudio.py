from __future__ import annotations

from typing import Any

import httpx


_PLACEHOLDER_MODEL_VALUES = {
    "",
    "auto",
    "default",
    "none",
    "local-model",
}


def is_placeholder_model_name(value: str | None) -> bool:
    if value is None:
        return True
    return value.strip().lower() in _PLACEHOLDER_MODEL_VALUES


def list_lmstudio_models(*, base_url: str, api_key: str | None) -> list[dict[str, Any]]:
    endpoint = f"{base_url.rstrip('/')}/models"
    headers: dict[str, str] = {}
    if api_key and api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"

    try:
        response = httpx.get(endpoint, headers=headers, timeout=8.0)
        response.raise_for_status()
    except Exception as exc:
        raise ValueError(
            "Unable to query LM Studio models endpoint. "
            "Ensure LM Studio server is running and LMSTUDIO_BASE_URL is correct."
        ) from exc

    payload = response.json()
    if not isinstance(payload, dict):
        return []

    rows = payload.get("data")
    if not isinstance(rows, list):
        return []

    cleaned: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        model_id = row.get("id")
        if isinstance(model_id, str) and model_id.strip():
            cleaned.append(row)
    return cleaned


def auto_detect_lmstudio_chat_model(*, base_url: str, api_key: str | None) -> str:
    rows = list_lmstudio_models(base_url=base_url, api_key=api_key)
    if not rows:
        raise ValueError(
            "LM Studio returned no models. Load at least one model in LM Studio."
        )

    for row in rows:
        if not _looks_like_embedding_model(row):
            model_id = str(row.get("id") or "").strip()
            if model_id:
                return model_id

    fallback = str(rows[0].get("id") or "").strip()
    if fallback:
        return fallback

    raise ValueError("LM Studio model list did not include usable model IDs")


def auto_detect_lmstudio_embedding_model(*, base_url: str, api_key: str | None) -> str:
    candidates = list_lmstudio_embedding_models(base_url=base_url, api_key=api_key)
    if candidates:
        return candidates[0]
    raise ValueError(
        "LM Studio returned no models. Load at least one embedding-capable model."
    )


def list_lmstudio_embedding_models(*, base_url: str, api_key: str | None) -> list[str]:
    rows = list_lmstudio_models(base_url=base_url, api_key=api_key)
    if not rows:
        return []

    ranked: list[tuple[int, str]] = []
    fallback: list[str] = []

    for row in rows:
        model_id = str(row.get("id") or "").strip()
        if not model_id:
            continue
        if _looks_like_embedding_model(row):
            ranked.append((_embedding_model_score(row), model_id))
        else:
            fallback.append(model_id)

    if ranked:
        ranked.sort(key=lambda item: item[0], reverse=True)
        return [model_id for _, model_id in ranked]

    # If no embedding-specific models can be identified, fall back to any loaded model IDs.
    return fallback


def _looks_like_embedding_model(row: dict[str, Any]) -> bool:
    pieces: list[str] = []
    for key in ("id", "object", "type", "name", "description"):
        value = row.get(key)
        if isinstance(value, str):
            pieces.append(value)

    architecture = row.get("architecture")
    if isinstance(architecture, dict):
        for key in ("type", "modality"):
            value = architecture.get(key)
            if isinstance(value, str):
                pieces.append(value)

    haystack = " ".join(pieces).lower()
    markers = (
        "embed",
        "embedding",
        "nomic-embed",
        "text-embedding",
        "bge",
        "e5",
        "gte",
        "all-minilm",
    )
    return any(marker in haystack for marker in markers)


def _embedding_model_score(row: dict[str, Any]) -> int:
    pieces: list[str] = []
    for key in ("id", "object", "type", "name", "description"):
        value = row.get(key)
        if isinstance(value, str):
            pieces.append(value)

    architecture = row.get("architecture")
    if isinstance(architecture, dict):
        for key in ("type", "modality"):
            value = architecture.get(key)
            if isinstance(value, str):
                pieces.append(value)

    haystack = " ".join(pieces).lower()
    score = 0

    # Prefer explicit embedding model families first.
    if "text-embedding" in haystack:
        score += 100
    if "nomic-embed" in haystack:
        score += 95
    if "embedding" in haystack:
        score += 80
    if "embed" in haystack:
        score += 70

    # Common open local embedding families.
    if "bge" in haystack:
        score += 60
    if "e5" in haystack:
        score += 50
    if "gte" in haystack:
        score += 45
    if "all-minilm" in haystack:
        score += 40

    return score
