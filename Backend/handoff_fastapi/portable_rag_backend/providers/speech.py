from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Any, Iterable
from uuid import uuid4

import httpx

from portable_rag_backend.config import PortableRAGSettings


class SpeechService:
    """Speech-to-text and text-to-speech helper methods."""

    def __init__(self, settings: PortableRAGSettings):
        self.settings = settings
        self._whisper_model = None

    def transcribe(self, file_path: Path) -> str:
        provider = str(self.settings.stt_provider or "auto").strip().lower()

        if provider == "whisper":
            return self._transcribe_with_whisper(file_path)

        if provider == "deepgram":
            return self._transcribe_with_deepgram(file_path)

        # auto mode: use local Whisper first, then Deepgram as a fallback.
        try:
            return self._transcribe_with_whisper(file_path)
        except Exception as whisper_error:
            try:
                return self._transcribe_with_deepgram(file_path)
            except Exception as deepgram_error:
                raise RuntimeError(
                    "STT failed with Whisper and Deepgram fallback. "
                    f"Whisper error: {whisper_error}. "
                    f"Deepgram error: {deepgram_error}"
                ) from deepgram_error

    def _transcribe_with_whisper(self, file_path: Path) -> str:
        from faster_whisper import WhisperModel

        if self._whisper_model is None:
            self._whisper_model = WhisperModel(
                self.settings.whisper_model_size,
                device="cpu",
                compute_type="int8",
            )

        segments, _ = self._whisper_model.transcribe(str(file_path))
        parts = [segment.text.strip() for segment in segments if segment.text]
        transcript = " ".join(parts).strip()
        if not transcript:
            raise ValueError("Whisper produced an empty transcript")
        return transcript

    def _transcribe_with_deepgram(self, file_path: Path) -> str:
        api_key = str(self.settings.deepgram_api_key or "").strip()
        if not api_key:
            raise RuntimeError(
                "Deepgram fallback is not configured. Set DEEPGRAM_API_KEY."
            )

        audio_bytes = file_path.read_bytes()
        if not audio_bytes:
            raise ValueError("Audio file is empty")

        model = str(self.settings.deepgram_stt_model or "nova-3").strip() or "nova-3"
        base_url = str(self.settings.deepgram_base_url or "https://api.deepgram.com/v1").rstrip("/")
        content_type = (
            mimetypes.guess_type(str(file_path))[0]
            or "application/octet-stream"
        )

        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{base_url}/listen",
                params={
                    "model": model,
                    "smart_format": "true",
                    "punctuate": "true",
                },
                headers={
                    "Authorization": f"Token {api_key}",
                    "Content-Type": content_type,
                },
                content=audio_bytes,
            )

        response.raise_for_status()
        transcript = _extract_deepgram_transcript(response.json())
        if not transcript:
            raise RuntimeError("Deepgram returned an empty transcript")

        return transcript

    def synthesize(
        self,
        text: str,
        language: str | None = None,
        speaker: str | None = None,
    ) -> Path:
        from gtts import gTTS

        if not text.strip():
            raise ValueError("Text for synthesis cannot be empty")

        tld = "com"
        if speaker == "speaker_2":
            tld = "co.uk"

        out_dir = self.settings.resolve_audio_dir()
        prefix = speaker or "tts"
        output_path = out_dir / f"{prefix}_{uuid4().hex}.mp3"
        gTTS(
            text=text,
            lang=language or self.settings.tts_language,
            tld=tld,
        ).save(str(output_path))
        return output_path

    def merge_audio_files(
        self,
        files: Iterable[Path],
        output_name: str | None = None,
    ) -> Path:
        """Concatenate MP3 files in order as a lightweight merge strategy."""
        out_dir = self.settings.resolve_audio_dir()
        target = out_dir / (output_name or f"audio_overview_{uuid4().hex}.mp3")

        with target.open("wb") as out_handle:
            for file_path in files:
                out_handle.write(Path(file_path).read_bytes())

        return target


def _extract_deepgram_transcript(payload: Any) -> str:
    if not isinstance(payload, dict):
        return ""

    results = payload.get("results")
    if not isinstance(results, dict):
        return ""

    channels = results.get("channels")
    if not isinstance(channels, list) or not channels:
        return ""

    first_channel = channels[0]
    if not isinstance(first_channel, dict):
        return ""

    alternatives = first_channel.get("alternatives")
    if not isinstance(alternatives, list) or not alternatives:
        return ""

    first_alt = alternatives[0]
    if not isinstance(first_alt, dict):
        return ""

    return str(first_alt.get("transcript") or "").strip()
