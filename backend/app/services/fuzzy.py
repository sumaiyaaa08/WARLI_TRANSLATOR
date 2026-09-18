"""Fuzzy lookup — honest, small-scale neural retrieval + spelling fallback.

When exact dictionary lookup misses a token, two layers try to rescue it:

1. NEURAL (semantic): a pretrained multilingual MiniLM embeds the token and
   every dictionary key; cosine >= threshold accepts the closest key
   ("infant" -> "child" 0.84, "cattle" -> "cow" 0.91). NO training, NO corpus
   needed — the model is frozen and public. Garbage ("xyzqqq" -> 0.28) stays
   unmatched. Disabled gracefully when the model can't load (offline box
   without a cached model): layer 2 still works.
2. SPELLING (difflib): character-level close match for typos ("watre" ->
   "water"). Stdlib only, always available.

Every fuzzy hit is flagged on the token AND summarized in response warnings,
so the UI can show "closest meaning used" instead of silently guessing.
"""
from __future__ import annotations

import difflib
import logging
import threading
from typing import Dict, List, Optional, Tuple

from ..config import settings

logger = logging.getLogger("warli.fuzzy")

_FUZZY_LANGS = ("en", "hi")


class FuzzyMatcher:
    """Process-wide matcher; indexes are built per Dictionary, lazily."""

    def __init__(self) -> None:
        self._model = None
        self._model_failed = False
        self._lock = threading.Lock()
        # id(dictionary) -> {lang: (keys, matrix or None)}
        self._indexes: Dict[int, Dict[str, tuple]] = {}

    # -- model ----------------------------------------------------------
    def _get_model(self):
        if self._model is not None or self._model_failed:
            return self._model
        with self._lock:
            if self._model is not None or self._model_failed:
                return self._model
            try:
                from sentence_transformers import SentenceTransformer  # type: ignore
                self._model = SentenceTransformer(settings.fuzzy_model)
                logger.info("Fuzzy neural model loaded: %s", settings.fuzzy_model)
            except Exception as exc:  # no internet / no cache / no package
                self._model_failed = True
                logger.warning(
                    "Neural fuzzy disabled (%s); spelling fallback still active.", exc
                )
            return self._model

    # -- index ----------------------------------------------------------
    def _index_for(self, dictionary, lang: str):
        """(keys, matrix|None) for this dictionary+lang; builds on first use."""
        did = id(dictionary)
        bucket = self._indexes.setdefault(did, {})
        if lang in bucket:
            return bucket[lang]
        keys = dictionary.source_keys(lang)
        matrix = None
        model = self._get_model() if keys else None
        if model is not None:
            try:
                matrix = model.encode(keys, convert_to_tensor=True,
                                      normalize_embeddings=True)
            except Exception as exc:
                logger.warning("Fuzzy embedding failed: %s", exc)
                matrix = None
        bucket[lang] = (keys, matrix)
        return bucket[lang]

    def warm(self, dictionary) -> None:
        """Build indexes in a daemon thread so boot never blocks on ML."""

        def _run():
            try:
                for lang in _FUZZY_LANGS:
                    self._index_for(dictionary, lang)
            except Exception as exc:  # never break the app for fuzzy
                logger.warning("Fuzzy warm-up failed: %s", exc)

        threading.Thread(target=_run, daemon=True).start()

    def invalidate(self, dictionary) -> None:
        self._indexes.pop(id(dictionary), None)

    # -- suggest --------------------------------------------------------
    def suggest(self, dictionary, token: str, lang: str
                ) -> Optional[Tuple[str, str, float]]:
        """Return (matched_key, method, score) or None.

        method is 'neural' or 'spelling'. Only called for tokens that missed
        exact lookup; caller decides what qualifies (alpha, len>=3, ...).
        """
        if lang not in _FUZZY_LANGS:
            return None
        norm = token.strip().lower()
        if len(norm) < 3:
            return None
        keys, matrix = self._index_for(dictionary, lang)
        if not keys or norm in keys:
            return None
        model = self._get_model()
        if model is not None and matrix is not None:
            try:
                q = model.encode(norm, convert_to_tensor=True,
                                 normalize_embeddings=True)
                scores = (q @ matrix.T).tolist()
                best = max(range(len(keys)), key=lambda i: scores[i])
                if scores[best] >= settings.fuzzy_threshold:
                    return keys[best], "neural", round(float(scores[best]), 2)
            except Exception as exc:
                logger.warning("Fuzzy neural suggest failed: %s", exc)
        # Spelling fallback (typos): always available, high bar.
        close = difflib.get_close_matches(norm, keys, n=1, cutoff=0.82)
        if close:
            return close[0], "spelling", 0.82
        return None


_fuzzy: Optional[FuzzyMatcher] = None


def get_fuzzy() -> FuzzyMatcher:
    global _fuzzy
    if _fuzzy is None:
        _fuzzy = FuzzyMatcher()
    return _fuzzy
