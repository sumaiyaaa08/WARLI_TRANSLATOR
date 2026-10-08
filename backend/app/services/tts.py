"""TTS service — Warli (Devanagari) text -> speech audio.

APPROXIMATION WARNING (read me)
-------------------------------
There is NO Warli TTS model. To produce Speech -> Warli Speech output we use the
closest available option: a Hindi/Marathi voice (Google TTS via `gTTS`) reading
the Devanagari Warli text. This is a PRACTICAL APPROXIMATION of Warli
pronunciation, NOT a true Warli voice model. The API response flags this so the
UI can disclose it to users.

The optional pronunciation layer (services/pronunciation.py) is applied first to
nudge the voice toward more accurate Warli sounds. If that layer is empty/
disabled, synthesis proceeds on the raw Warli text — the pipeline never breaks.

gTTS requires internet access (it calls Google's endpoint). If offline, set
WARLI_TTS_ENABLED=false; text mode keeps working.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import List, Optional

from ..config import settings
from .pronunciation import get_pronunciation_layer

logger = logging.getLogger("warli.tts")


class TTSError(RuntimeError):
    """Raised for any text-to-speech failure the caller should see as JSON."""


@dataclass
class TTSResult:
    audio_bytes: bytes
    mime: str = "audio/mpeg"
    voice_lang: str = "hi"
    approximation: bool = True                 # always True: no real Warli TTS
    pronunciation_applied: bool = False
    pronunciation_words: List[str] = None      # type: ignore[assignment]
    text_spoken: str = ""

    def __post_init__(self):
        if self.pronunciation_words is None:
            self.pronunciation_words = []


class GttsWarli:
    """Marathi (preferred) / Hindi gTTS voice reading Warli Devanagari.

    Warli is a Marathi-family language, so the default voice is Marathi ('mr');
    it maps Devanagari to Warli sounds more faithfully than Hindi. Still an
    approximation — there is no true Warli TTS model.
    """

    def synthesize(self, warli_text: str, apply_pronunciation: bool = True) -> TTSResult:
        if not settings.tts_enabled:
            raise TTSError("TTS is disabled on this server (WARLI_TTS_ENABLED=false).")
        warli_text = (warli_text or "").strip()
        if not warli_text:
            raise TTSError("Cannot synthesize empty Warli text.")

        try:
            from gtts import gTTS  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise TTSError(
                "gTTS is not installed. Run `pip install -r requirements.txt`."
            ) from exc

        # 1) Optional pronunciation adjustment (decoupled; no-op if inactive).
        if apply_pronunciation:
            layer = get_pronunciation_layer()
            text_for_tts, changed, applied = layer.adjust(warli_text)
        else:
            text_for_tts, changed, applied = warli_text, False, []

        # 2) Synthesize with the closest available voice.
        lang = settings.tts_voice_lang or "mr"
        try:
            tts = gTTS(text=text_for_tts, lang=lang, slow=settings.tts_slow)
            buf = io.BytesIO()
            tts.write_to_fp(buf)
            audio = buf.getvalue()
        except Exception as exc:  # gTTS raises assorted network/runtime errors
            logger.error("TTS synthesis failed: %s", exc)
            raise TTSError(
                "Speech synthesis failed. gTTS needs internet access; check the "
                "connection or disable speech mode."
            ) from exc

        if not audio:
            raise TTSError("Speech synthesis produced no audio.")

        return TTSResult(
            audio_bytes=audio,
            mime="audio/mpeg",
            voice_lang=lang,
            approximation=True,
            pronunciation_applied=changed,
            pronunciation_words=applied,
            text_spoken=text_for_tts,
        )


_tts: Optional[GttsWarli] = None


def get_tts() -> GttsWarli:
    global _tts
    if _tts is None:
        _tts = GttsWarli()
    return _tts
