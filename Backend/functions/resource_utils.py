import hashlib
import json
import re
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional
from functions.youtube_quiz_functions import extract_video_id

def _assessment_signature(payload: Dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, default=str, ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

def _normalize_url(url_value) -> str:
    """Extract a clean absolute URL from string/list/legacy list-like string inputs."""
    if not url_value:
        return ""

    def _unwrap_quotes(value: Any) -> str:
        text = str(value or "").strip()
        while (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
            text = text[1:-1].strip()
        return text

    raw_value = url_value
    if isinstance(raw_value, list):
        raw_value = next((item for item in raw_value if str(item or "").strip()), "")

    text = _unwrap_quotes(raw_value)
    if not text:
        return ""

    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text.replace("'", '"'))
            if isinstance(parsed, list):
                text = _unwrap_quotes(next((item for item in parsed if str(item or "").strip()), ""))
        except Exception:
            pass

    text = _unwrap_quotes(text).replace("\\u0026", "&").replace("&amp;", "&")
    matched = re.search(r"https?://[^\s'\"\]]+", text)
    if matched:
        text = matched.group(0).strip()

    if not re.match(r"^https?://", text, flags=re.IGNORECASE) and re.match(
        r"^[\w.-]+\.[a-z]{2,}(?:/|$)", text, flags=re.IGNORECASE
    ):
        text = f"https://{text}"

    return text if re.match(r"^https?://", text, flags=re.IGNORECASE) else ""

def _resource_from_playlist(
    skill: str,
    concept: str,
    url: str,
    source: str,
    approval_status: str,
    thumbnail_url: Optional[str] = None,
    extra_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    now = datetime.utcnow()
    extra = extra_meta or {}
    return {
        "resource_id": secrets.token_hex(12),
        "title": concept or f"{skill} video",
        "description": f"AI-suggested video for {skill}.",
        "url": _normalize_url(url),
        "thumbnail_url": _normalize_url(thumbnail_url) if thumbnail_url else None,
        "resource_type": "youtube",
        "skill": skill,
        "source": source,
        "approval_status": approval_status,
        "created_date": now,
        "updated_date": now,
        "approved_date": now if approval_status == "approved" else None,
        "approved_by": None,
        # Phase 4 fields
        "blueprint_subtopic": extra.get("subtopic_name") or extra.get("blueprint_subtopic"),
        "difficulty_tag": extra.get("difficulty"),
        "relevance_score": extra.get("relevance_score"),
        "search_query_used": extra.get("search_query_used"),
        "student_rating": None,
    }

def _resource_from_document(
    skill: str,
    title: str,
    description: str,
    url: str,
    resource_type: str,
    source: str,
    approval_status: str,
    extra_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    now = datetime.utcnow()
    extra = extra_meta or {}
    return {
        "resource_id": secrets.token_hex(12),
        "title": title or f"{skill} resource",
        "description": description or f"AI-suggested {resource_type} resource.",
        "url": _normalize_url(url),
        "resource_type": resource_type,
        "skill": skill,
        "source": source,
        "approval_status": approval_status,
        "created_date": now,
        "updated_date": now,
        "approved_date": now if approval_status == "approved" else None,
        "approved_by": None,
        # Phase 4 fields
        "blueprint_subtopic": extra.get("blueprint_subtopic"),
        "difficulty_tag": extra.get("difficulty_tag"),
        "relevance_score": extra.get("relevance_score"),
        "search_query_used": extra.get("search_query_used"),
        "student_rating": None,
    }

def _build_resources_from_outputs(
    playlists: List[Dict[str, Any]],
    deepsearch_results: List[Dict[str, Any]],
    source: str,
    approval_status: str,
    max_items: int = 60,
) -> List[Dict[str, Any]]:
    resources: List[Dict[str, Any]] = []

    for skill_playlist in playlists or []:
        skill = str(skill_playlist.get("skill") or "General")
        for item in skill_playlist.get("playlist", []) or []:
            if not isinstance(item, dict):
                continue
            resource = _resource_from_playlist(
                skill=skill,
                concept=str(item.get("concept") or f"{skill} tutorial"),
                url=_normalize_url(item.get("youtube_link")),
                source=source,
                approval_status=approval_status,
                thumbnail_url=str(item.get("thumbnail_url") or ""),
                extra_meta=item,
            )
            resources.append(resource)

    for recommendation in deepsearch_results or []:
        if not isinstance(recommendation, dict):
            continue
        skill = str(recommendation.get("skill") or "General")

        for doc in recommendation.get("documents", []) or []:
            if not isinstance(doc, dict):
                continue

            resources.append(
                _resource_from_document(
                    skill=skill,
                    title=str(doc.get("title") or f"{skill} article"),
                    description=str(doc.get("content") or "AI-suggested reading resource."),
                    url=_normalize_url(doc.get("url") or doc.get("link")),
                    resource_type="article",
                    source=source,
                    approval_status=approval_status,
                    extra_meta=doc,
                )
            )

        for blog_url in recommendation.get("blogs", []) or []:
            url = _normalize_url(blog_url)
            if not url:
                continue
            resources.append(
                _resource_from_document(
                    skill=skill,
                    title=f"{skill} blog reference",
                    description="AI-suggested blog resource.",
                    url=url,
                    resource_type="blog",
                    source=source,
                    approval_status=approval_status,
                )
            )

    deduped: List[Dict[str, Any]] = []
    seen = set()
    for resource in resources:
        key = (resource.get("url") or "", resource.get("title") or "")
        if key in seen:
            continue
        seen.add(key)
        deduped.append(resource)
        if len(deduped) >= max_items:
            break

    return deduped

def _to_iso(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value

def _serialize_resource(resource: Dict[str, Any]) -> Dict[str, Any]:
    module_id = resource.get("module_id")
    # prefer existing thumbnail fields, otherwise try to derive from URLs
    thumb = resource.get("thumbnail_url") or resource.get("thumbnail") or None
    if not thumb:
        # try to extract a youtube video id and map to youtube static thumbnail
        try:
            vid = extract_video_id(str(resource.get("url") or "") ) or extract_video_id(str(resource.get("youtube_link") or ""))
            if vid:
                thumb = f"https://img.youtube.com/vi/{vid}/maxresdefault.jpg"
        except Exception:
            thumb = None

    return {
        "resource_id": resource.get("resource_id"),
        "title": resource.get("title", "Untitled Resource"),
        "description": resource.get("description", ""),
        "url": resource.get("url", ""),
        "resource_type": resource.get("resource_type", "article"),
        "skill": resource.get("skill", "General"),
        "thumbnail_url": thumb,
        "module_id": str(module_id) if module_id else None,
        "module_name": resource.get("module_name"),
        "source": resource.get("source", "ai"),
        "approval_status": resource.get("approval_status", "pending"),
        "created_date": _to_iso(resource.get("created_date")),
        "updated_date": _to_iso(resource.get("updated_date")),
        "approved_date": _to_iso(resource.get("approved_date")),
        "approved_by": str(resource.get("approved_by")) if resource.get("approved_by") else None,
        "blueprint_subtopic": resource.get("blueprint_subtopic"),
        "difficulty_tag": resource.get("difficulty_tag"),
        "relevance_score": resource.get("relevance_score"),
        "search_query_used": resource.get("search_query_used"),
        "student_rating": resource.get("student_rating"),
    }

def _resource_counts(resources: List[Dict[str, Any]]) -> Dict[str, int]:
    approved = sum(1 for resource in resources if resource.get("approval_status") == "approved")
    rejected = sum(1 for resource in resources if resource.get("approval_status") == "rejected")
    pending = max(0, len(resources) - approved - rejected)
    return {
        "total": len(resources),
        "approved": approved,
        "pending": pending,
        "rejected": rejected,
    }
