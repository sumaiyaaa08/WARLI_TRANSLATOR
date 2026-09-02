"""ASR service — speech (English/Hindi) -> text.

We use an EXISTING pretrained speech-to-text model (Whisper) for input; we do not
train ASR from scratch. Default backend is `faster-whisper` (CPU friendly, no
heavy torch install). The model is loaded lazily on first transcription so the
API boots quickly, and every failure mode degrades to a clear `ASRError` that the
route layer turns into a JSON error response.

Swap the backend by setting WARLI_ASR_BACKEND (see config.py). Adding another
provider (e.g. an OpenAI Whisper HTTP API) means implementing `transcribe()` in a
new class — the routes never change.
"""
from __future__ import annotations

import logging
import os
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from ..config import settings

logger = logging.getLogger("warli.asr")

# Audio extensions we accept from the client.
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac", ".mp4"}


class ASRError(RuntimeError):
    """Raised for any speech-to-text failure the caller should see as JSON."""


@dataclass
class ASRResult:
    text: str
    language: str          # detected/forced language code, e.g. 'en'/'hi'
    backend: str
    duration_seconds: Optional[float] = None


class WhisperASR:
    """Thin wrapper around faster-whisper (or openai-whisper as a fallback)."""

    def __init__(self) -> None:
        self._model = None
        self._lock = threading.Lock()

    # -- lazy model loading --------------------------------------------------
    def _ensure_model(self):
        if self._model is not None:
            return self._model
        with self._lock:
            if self._model is not None:
                return self._model
            backend = settings.asr_backend.lower()
            if backend == "faster-whisper":
                try:
                    from faster_whisper import WhisperModel  # type: ignore
                except ImportError as exc:  # pragma: no cover - depends on env
                    raise ASRError(
                        "faster-whisper is not installed. Run `pip install -r "
                        "requirements.txt` (it pulls faster-whisper), or set "
                        "WARLI_ASR_ENABLED=false and use /translate/text."
                    ) from exc
                logger.info(
                    "Loading faster-whisper model '%s' on %s (%s)...",
                    settings.asr_model_size, settings.asr_device, settings.asr_compute_type,
                )
                self._model = WhisperModel(
                    settings.asr_model_size,
                    device=settings.asr_device,
                    compute_type=settings.asr_compute_type,
                )
                self._backend_kind = "faster-whisper"
            elif backend in ("openai-whisper", "whisper"):
                try:
                    import whisper  # type: ignore
                except ImportError as exc:  # pragma: no cover
                    raise ASRError(
                        "openai-whisper is not installed. `pip install openai-whisper` "
                        "or use the faster-whisper backend."
                    ) from exc
                self._model = whisper.load_model(settings.asr_model_size)
                self._backend_kind = "openai-whisper"
            else:
                raise ASRError(f"Unknown ASR backend '{settings.asr_backend}'.")
            return self._model

    # -- public API ----------------------------------------------------------
    def transcribe(
        self,
        audio_bytes: bytes,
        source_lang: str = "auto",
        filename: Optional[str] = None,
    ) -> ASRResult:
        # Validate the upload format first so an unsupported file always yields a
        # clear 415 (mapped in the route), independent of server ASR config.
        suffix = self._validate_and_suffix(filename)
        if not audio_bytes:
            raise ASRError("Empty audio upload.")
        if not settings.asr_enabled:
            raise ASRError("ASR is disabled on this server (WARLI_ASR_ENABLED=false).")
        model = self._ensure_model()
        lang = None if source_lang in ("auto", "", None) else source_lang

        # Write to a temp file (both whisper backends accept a path).
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix or ".wav")
        try:
            tmp.write(audio_bytes)
            tmp.flush()
            tmp.close()

            if getattr(self, "_backend_kind", "faster-whisper") == "faster-whisper":
                segments, info = model.transcribe(tmp.name, language=lang)
                text = " ".join(seg.text.strip() for seg in segments).strip()
                detected = getattr(info, "language", lang or "en")
                duration = getattr(info, "duration", None)
            else:  # openai-whisper
                result = model.transcribe(tmp.name, language=lang)
                text = str(result.get("text", "")).strip()
                detected = result.get("language", lang or "en")
                duration = None

            if not text:
                raise ASRError(
                    "No speech detected in the audio (empty transcription). "
                    "Check microphone input or try a clearer recording."
                )
            return ASRResult(
                text=text,
                language=str(detected),
                backend=getattr(self, "_backend_kind", settings.asr_backend),
                duration_seconds=duration,
            )
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    @staticmethod
    def _validate_and_suffix(filename: Optional[str]) -> str:
        if not filename:
            return ".wav"
        ext = Path(filename).suffix.lower()
        if ext and ext not in ALLOWED_AUDIO_EXTENSIONS:
            raise ASRError(
                f"Unsupported audio format '{ext}'. Allowed: "
                + ", ".join(sorted(ALLOWED_AUDIO_EXTENSIONS))
            )
        return ext


_asr: Optional[WhisperASR] = None


def get_asr() -> WhisperASR:
    global _asr
    if _asr is None:
        _asr = WhisperASR()
    return _asr
