from typing import Any, Dict, Iterable, List

from youtube_transcript_api import YouTubeTranscriptApi


def _normalize_transcript_entries(transcript_payload: Any) -> List[Dict[str, Any]]:
    if transcript_payload is None:
        return []

    if hasattr(transcript_payload, "to_raw_data"):
        raw_data = transcript_payload.to_raw_data()
        if isinstance(raw_data, list):
            return [entry for entry in raw_data if isinstance(entry, dict)]

    if isinstance(transcript_payload, list):
        return [entry for entry in transcript_payload if isinstance(entry, dict)]

    if hasattr(transcript_payload, "__iter__"):
        normalized: List[Dict[str, Any]] = []
        for entry in transcript_payload:
            if isinstance(entry, dict):
                normalized.append(entry)
                continue

            text = getattr(entry, "text", None)
            start = getattr(entry, "start", None)
            duration = getattr(entry, "duration", None)
            if text is not None and start is not None:
                normalized.append(
                    {
                        "text": str(text),
                        "start": float(start),
                        "duration": float(duration or 0),
                    }
                )
        return normalized

    return []


def _get_transcript_list(video_id: str):
    if hasattr(YouTubeTranscriptApi, "list_transcripts"):
        return YouTubeTranscriptApi.list_transcripts(video_id)

    api = YouTubeTranscriptApi()

    if hasattr(api, "list_transcripts"):
        return api.list_transcripts(video_id)

    if hasattr(api, "list"):
        return api.list(video_id)

    raise AttributeError("No transcript listing API available in youtube_transcript_api")


def _select_transcript(transcript_list, languages: List[str]):
    for lang in languages:
        if hasattr(transcript_list, "find_manually_created_transcript"):
            try:
                transcript = transcript_list.find_manually_created_transcript([lang])
                print(f"Using manually created transcript in {lang}")
                return transcript
            except Exception:
                pass

        if hasattr(transcript_list, "find_generated_transcript"):
            try:
                transcript = transcript_list.find_generated_transcript([lang])
                print(f"Using auto-generated transcript in {lang}")
                return transcript
            except Exception:
                pass

        if hasattr(transcript_list, "find_transcript"):
            try:
                transcript = transcript_list.find_transcript([lang])
                print(f"Using transcript in {lang}")
                return transcript
            except Exception:
                pass

    for transcript in transcript_list:
        language_code = getattr(transcript, "language_code", "unknown")
        print(f"Preferred languages unavailable. Using transcript in {language_code}")
        return transcript

    return None


def fetch_transcript_entries(video_id: str, languages: Iterable[str] = ("en",)) -> List[Dict[str, Any]]:
    requested_languages = [lang for lang in (languages or ["en"]) if isinstance(lang, str) and lang.strip()]
    if not requested_languages:
        requested_languages = ["en"]

    list_api_error: Exception | None = None

    try:
        transcript_list = _get_transcript_list(video_id)
        transcript = _select_transcript(transcript_list, requested_languages)

        if transcript is None:
            raise Exception("No transcripts available for this video.")

        transcript_data = transcript.fetch()
        normalized_entries = _normalize_transcript_entries(transcript_data)
        if normalized_entries:
            return normalized_entries
    except Exception as exc:
        list_api_error = exc

    # Fallback for newer interfaces that expose direct fetch.
    try:
        api = YouTubeTranscriptApi()
        if hasattr(api, "fetch"):
            fetched = api.fetch(video_id, languages=requested_languages)
            normalized_entries = _normalize_transcript_entries(fetched)
            if normalized_entries:
                return normalized_entries

        if hasattr(YouTubeTranscriptApi, "get_transcript"):
            fetched = YouTubeTranscriptApi.get_transcript(video_id, languages=requested_languages)
            normalized_entries = _normalize_transcript_entries(fetched)
            if normalized_entries:
                return normalized_entries
    except Exception as exc:
        if list_api_error is not None:
            raise Exception(f"{exc} | list API error: {list_api_error}")
        raise

    if list_api_error is not None:
        raise list_api_error

    raise Exception("No transcripts available for this video.")
