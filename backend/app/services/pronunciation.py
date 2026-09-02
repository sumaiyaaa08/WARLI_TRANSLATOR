"""OPTIONAL pronunciation fine-tuning layer (stretch goal).

PURPOSE
-------
The base pipeline uses a Hindi/Marathi TTS voice to read Warli Devanagari text.
That voice applies Hindi/Marathi phonetics, which may not match authentic Warli
pronunciation. This module nudges the text toward Warli sounds BEFORE it is
handed to TTS, using a word -> respelling lexicon derived from the research
papers + transcribed YouTube/field audio (data/pronunciation_audio/lexicon.json).

DECOUPLING CONTRACT (important)
-------------------------------
* The core translation pipeline does NOT depend on this module.
* If the lexicon is empty/missing, or the feature is disabled, `adjust()` returns
  the input unchanged and `available` is False.
* Accuracy scales with how much transcribed Warli audio the team collects. It is
  expected to improve over time, not be complete at launch.

More advanced path (only if enough transcribed audio is collected): fine-tune a
small open-source TTS/ASR model — see README "Advanced" note. That would be a new
class exposing the same `adjust()` method, wired via config.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional

from ..config import settings

logger = logging.getLogger("warli.pronunciation")

_TOKEN_RE = re.compile(r"\S+")


class PronunciationLayer:
    """Word-level Devanagari respelling applied before TTS."""

    def __init__(self, path: Path, enabled: bool = True):
        self.path = path
        self.enabled = enabled
        self.lexicon: Dict[str, dict] = {}
        self.load()

    def load(self) -> None:
        self.lexicon = {}
        if not self.path.exists():
            logger.info("No pronunciation lexicon at %s (module inactive).", self.path)
            return
        try:
            with self.path.open("r", encoding="utf-8") as fh:
                raw = json.load(fh)
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("Failed to load pronunciation lexicon: %s", exc)
            return
        for entry in raw.get("lexicon", []) if isinstance(raw, dict) else []:
            if isinstance(entry, dict) and entry.get("warli") and entry.get("respell"):
                self.lexicon[str(entry["warli"])] = entry
        logger.info("Pronunciation lexicon loaded: %d entries", len(self.lexicon))

    @property
    def available(self) -> bool:
        return bool(self.enabled and self.lexicon)

    def __len__(self) -> int:
        return len(self.lexicon)

    def adjust(self, warli_text: str) -> tuple[str, bool, List[str]]:
        """Return (text_for_tts, changed, applied_words).

        Never raises; on any problem it returns the original text unchanged.
        """
        if not self.available or not warli_text:
            return warli_text, False, []
        applied: List[str] = []
        out_tokens: List[str] = []
        changed = False
        for token in _TOKEN_RE.findall(warli_text):
            entry = self.lexicon.get(token)
            if entry:
                out_tokens.append(str(entry["respell"]))
                applied.append(token)
                changed = True
            else:
                out_tokens.append(token)
        return (" ".join(out_tokens) if changed else warli_text), changed, applied


# --------------------------------------------------------------------------
# Lazy singleton
# --------------------------------------------------------------------------
_layer: Optional[PronunciationLayer] = None


def get_pronunciation_layer() -> PronunciationLayer:
    global _layer
    if _layer is None:
        _layer = PronunciationLayer(
            settings.pronunciation_lexicon_path,
            enabled=settings.pronunciation_enabled,
        )
    return _layer


def reload_pronunciation_layer() -> PronunciationLayer:
    layer = get_pronunciation_layer()
    layer.load()
    return layer
