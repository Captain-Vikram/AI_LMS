from __future__ import annotations

from pathlib import Path
from typing import Iterable
from uuid import uuid4

from portable_rag_backend.config import PortableRAGSettings


class SpeechService:
    """Speech-to-text and text-to-speech helper methods."""

    def __init__(self, settings: PortableRAGSettings):
        self.settings = settings
        self._whisper_model = None

    def transcribe(self, file_path: Path) -> str:
        from faster_whisper import WhisperModel

        if self._whisper_model is None:
            self._whisper_model = WhisperModel(
                self.settings.whisper_model_size,
                device="cpu",
                compute_type="int8",
            )

        segments, _ = self._whisper_model.transcribe(str(file_path))
        parts = [segment.text.strip() for segment in segments if segment.text]
        return " ".join(parts).strip()

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
