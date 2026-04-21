from __future__ import annotations

import csv
import re
from datetime import timedelta
from io import StringIO
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup

from portable_rag_backend.providers.speech import SpeechService


class UnsupportedSourceTypeError(ValueError):
    pass


def extract_text_from_url(url: str, timeout_seconds: int = 30) -> str:
    youtube_video_id = _extract_youtube_video_id(url)
    if youtube_video_id:
        return _extract_text_from_youtube_video(
            video_id=youtube_video_id,
            source_url=url,
        )

    response = httpx.get(url, timeout=timeout_seconds, follow_redirects=True)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    for script in soup(["script", "style", "noscript"]):
        script.extract()

    text = "\n".join(line.strip() for line in soup.get_text("\n").splitlines())
    text = "\n".join(line for line in text.splitlines() if line)

    if not text.strip():
        raise ValueError("No readable text could be extracted from URL")
    return text


def _extract_youtube_video_id(url: str) -> str | None:
    raw_url = str(url or "").strip()
    if not raw_url:
        return None

    parsed = urlparse(raw_url)
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]

    candidate = ""

    if host == "youtu.be":
        candidate = (parsed.path or "").strip("/").split("/")[0]
    elif host in {"youtube.com", "m.youtube.com", "youtube-nocookie.com"}:
        query = parse_qs(parsed.query or "")
        if "v" in query and query["v"]:
            candidate = str(query["v"][0]).strip()

        if not candidate:
            parts = [part for part in (parsed.path or "").split("/") if part]
            for marker in ("embed", "v", "shorts", "live"):
                if marker in parts:
                    idx = parts.index(marker)
                    if idx + 1 < len(parts):
                        candidate = parts[idx + 1]
                        break
    else:
        return None

    candidate = candidate.strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate):
        return candidate
    return None


def _extract_text_from_youtube_video(*, video_id: str, source_url: str) -> str:
    entries = _fetch_youtube_transcript_entries(video_id)
    if not entries:
        raise ValueError("YouTube transcript is unavailable for this video")

    lines: list[str] = []
    for entry in entries:
        text = str(entry.get("text") or entry.get("description") or "").strip()
        if not text:
            continue

        start_seconds = _safe_float(
            entry.get("start")
            if entry.get("start") is not None
            else entry.get("start_seconds")
        )
        timestamp = _format_seconds(start_seconds)
        lines.append(f"[{timestamp}] {text}")

    if not lines:
        raise ValueError("YouTube transcript is empty")

    transcript_text = "\n".join(lines)
    return (
        f"YouTube URL: {source_url}\n"
        f"Video ID: {video_id}\n\n"
        "Transcript:\n"
        f"{transcript_text}"
    )


def _fetch_youtube_transcript_entries(video_id: str) -> list[dict]:
    errors: list[str] = []

    try:
        from functions.transcript_utils import fetch_transcript_entries

        rows = fetch_transcript_entries(video_id, languages=("en",))
        if isinstance(rows, list):
            normalized = [item for item in rows if isinstance(item, dict)]
            if normalized:
                return normalized
    except Exception as exc:
        errors.append(str(exc))

    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        get_transcript_fn = getattr(YouTubeTranscriptApi, "get_transcript", None)
        if callable(get_transcript_fn):
            rows = get_transcript_fn(video_id, languages=["en"])
            if isinstance(rows, list):
                normalized = [item for item in rows if isinstance(item, dict)]
                if normalized:
                    return normalized

        api = YouTubeTranscriptApi()
        if hasattr(api, "fetch"):
            payload = api.fetch(video_id, languages=["en"])
            rows = payload.to_raw_data() if hasattr(payload, "to_raw_data") else payload
            if isinstance(rows, list):
                normalized = [item for item in rows if isinstance(item, dict)]
                if normalized:
                    return normalized
    except Exception as exc:
        errors.append(str(exc))

    detail = " | ".join(error for error in errors if error)
    raise ValueError(f"Could not fetch YouTube transcript for video '{video_id}': {detail}")


def _safe_float(value: object) -> float:
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return 0.0


def _format_seconds(total_seconds: float) -> str:
    delta = timedelta(seconds=max(0, int(total_seconds)))
    hours, remainder = divmod(delta.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def _extract_text_like(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="ignore").strip()
    if not text:
        raise ValueError("File content is empty")
    return text


def _extract_csv(path: Path) -> str:
    output = StringIO()
    with path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
        reader = csv.reader(handle)
        for row in reader:
            output.write(" | ".join(row))
            output.write("\n")
    text = output.getvalue().strip()
    if not text:
        raise ValueError("CSV contains no readable rows")
    return text


def _extract_pdf(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    parts = [page.extract_text() or "" for page in reader.pages]
    text = "\n".join(parts).strip()
    if not text:
        raise ValueError("PDF text extraction returned empty content")
    return text


def _extract_docx(path: Path) -> str:
    from docx import Document

    doc = Document(str(path))
    text = "\n".join(paragraph.text for paragraph in doc.paragraphs).strip()
    if not text:
        raise ValueError("DOCX text extraction returned empty content")
    return text


def extract_text_from_file(path: Path, speech_service: SpeechService | None = None) -> str:
    suffix = path.suffix.lower()

    if suffix in {".txt", ".md", ".json", ".py", ".js", ".ts", ".html", ".xml"}:
        return _extract_text_like(path)

    if suffix in {".csv"}:
        return _extract_csv(path)

    if suffix in {".pdf"}:
        return _extract_pdf(path)

    if suffix in {".docx"}:
        return _extract_docx(path)

    audio_video_ext = {".mp3", ".wav", ".m4a", ".mp4", ".mov", ".mkv"}
    if suffix in audio_video_ext:
        if speech_service is None:
            raise UnsupportedSourceTypeError(
                "Audio/video transcription requires SpeechService configuration"
            )
        return speech_service.transcribe(path)

    raise UnsupportedSourceTypeError(f"Unsupported source file extension: {suffix}")
