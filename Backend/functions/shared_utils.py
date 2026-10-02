"""
Shared utility functions used across multiple route and service modules.
Single source of truth — import from here instead of redefining locally.
"""
import hashlib
import json
import re
from datetime import datetime
from typing import Any, Dict, Optional
from bson import ObjectId


def to_object_id(value: Any) -> Optional[ObjectId]:
    """Safely convert any value to a BSON ObjectId. Returns None on failure."""
    try:
        return ObjectId(str(value))
    except Exception:
        return None


def to_iso(value: Any) -> Any:
    """Serialize datetime to ISO string; pass-through for all other types."""
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def clean_json_text(raw_text: str) -> str:
    """Strip markdown fences and extract JSON object/array from LLM output."""
    text = str(raw_text or "").strip()
    # Try regex match for a JSON block first
    json_match = re.search(r"[\{\[][\s\S]*[\}\]]", text)
    if json_match:
        text = json_match.group(0).strip()
    else:
        # Strip markdown code blocks as fallback
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?", "", text).strip()
        if text.endswith("```"):
            text = text[:-3].strip()
    return text


def assessment_signature(payload: Dict[str, Any]) -> str:
    """Deterministic SHA-256 hash of a JSON-serializable assessment payload."""
    serialized = json.dumps(payload, sort_keys=True, default=str, ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
