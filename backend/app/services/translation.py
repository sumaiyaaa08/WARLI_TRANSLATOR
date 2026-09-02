"""Translation engine: English/Hindi text -> Warli (Devanagari) text.

DESIGN GOALS (read before editing)
----------------------------------
1. Everything is DATA-DRIVEN. The dictionary, grammar rules and spelling
   corrections are loaded from JSON files under the project `data/` folder
   (paths come from `app.config.settings`). Nothing is hardcoded here.

2. The translation logic sits behind a clean interface (`TranslationEngine`).
   The API layer only ever talks to that interface via `build_engine()`, so the
   current rule-based implementation can later be swapped for a trained
   seq2seq model WITHOUT touching routes or services that call it.

PIPELINE (RuleBasedTranslator)
------------------------------
    source text
      -> tokenize (whitespace + punctuation aware, Devanagari safe)
      -> LOOKUP: greedy longest-phrase match, then single word, then
                 postposition map. Unmatched tokens pass through flagged.
      -> GRAMMAR RULES: reorder to Warli SOV order + apply coarse inflection
                 suffixes triggered by source cues (is/are -> present, was -> past).
      -> SPELLING CORRECTION: apply wrong->correct pairs from the annotated
                 voice recording (corrections.json) to normalize output.
      -> join into Warli text (+ romanized gloss where the dictionary has one).

The three stages (lookup, rules, correction) are independent methods so the
team can extend each one on its own.
"""
from __future__ import annotations

import json
import logging
import re
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ..config import settings

logger = logging.getLogger("warli.translation")


# --------------------------------------------------------------------------
# Data structures
# --------------------------------------------------------------------------
@dataclass
class MappedToken:
    """A source token (or phrase) after dictionary lookup."""

    source: str
    warli: str
    matched: bool
    pos: Optional[str] = None
    roman: Optional[str] = None
    is_postposition: bool = False


@dataclass
class CorrectionApplied:
    wrong: str
    correct: str
    source: Optional[str] = None


@dataclass
class TranslationResult:
    """Engine-agnostic result. The API layer maps this to response schemas."""

    source_text: str
    source_lang: str
    warli_text: str
    warli_roman: Optional[str] = None
    engine: str = "rule"
    tokens: List[MappedToken] = field(default_factory=list)
    unmatched: List[str] = field(default_factory=list)
    corrections_applied: List[CorrectionApplied] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


# --------------------------------------------------------------------------
# Loaders (tolerant: missing files / bad rows never crash the app)
# --------------------------------------------------------------------------
def _load_json(path: Path, default):
    if not path.exists():
        logger.warning("Data file missing, using default: %s", path)
        return default
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Failed to load %s (%s); using default.", path, exc)
        return default


class Dictionary:
    """Loads warli_dictionary.json and builds fast lookup maps.

    Two source languages are supported (English + Hindi). Phrase keys (multi-word)
    are stored separately from single-word keys so we can do greedy longest-match.
    """

    MAX_PHRASE_WORDS = 4

    def __init__(self, path: Path):
        self.path = path
        self.entries: List[dict] = []
        # lang -> {normalized key -> entry}
        self._word_maps: Dict[str, Dict[str, dict]] = {"en": {}, "hi": {}}
        self._phrase_maps: Dict[str, Dict[str, dict]] = {"en": {}, "hi": {}}
        self.load()

    def load(self) -> None:
        raw = _load_json(self.path, {"entries": []})
        self.entries = raw.get("entries", []) if isinstance(raw, dict) else []
        self._word_maps = {"en": {}, "hi": {}}
        self._phrase_maps = {"en": {}, "hi": {}}
        for entry in self.entries:
            if not isinstance(entry, dict) or not entry.get("warli"):
                continue
            for lang in ("en", "hi"):
                key = entry.get(lang)
                if not key:
                    continue
                norm = self._norm_key(str(key))
                if not norm:
                    continue
                if " " in norm:
                    self._phrase_maps[lang][norm] = entry
                else:
                    # First entry wins for a duplicate headword.
                    self._word_maps[lang].setdefault(norm, entry)
        logger.info(
            "Dictionary loaded: %d entries (%s)", len(self.entries), self.path.name
        )

    @staticmethod
    def _norm_key(text: str) -> str:
        return re.sub(r"\s+", " ", text.strip().lower())

    def __len__(self) -> int:
        return len(self.entries)

    def lookup(self, span: str, lang: str) -> Optional[dict]:
        """Look up a normalized span (single word or phrase) for a language."""
        if lang not in self._word_maps:
            return None
        norm = self._norm_key(span)
        if " " in norm:
            return self._phrase_maps[lang].get(norm)
        return self._word_maps[lang].get(norm)

    def all_entries(self) -> List[dict]:
        return list(self.entries)


class GrammarRules:
    """Word-order + inflection + postposition rules from grammar_rules.json."""

    def __init__(self, path: Path):
        self.path = path
        self.raw: dict = {}
        self.load()

    def load(self) -> None:
        self.raw = _load_json(self.path, {}) or {}

    @property
    def target_order(self) -> str:
        return str(self.raw.get("word_order", {}).get("target", "SOV")).upper()

    @property
    def inflections(self) -> dict:
        return self.raw.get("inflections", {}) or {}

    def postpositions(self, lang: str) -> Dict[str, str]:
        return self.raw.get("postpositions", {}).get(lang, {}) or {}

    @property
    def cue_rules(self) -> List[dict]:
        return self.raw.get("cue_rules", []) or []


class SpellingCorrector:
    """wrong -> correct Warli normalization from the annotated voice recording.

    This is a VALIDATION/CORRECTION dataset, not ASR training data. Applied after
    lookup so common mis-transliterations get auto-fixed.
    """

    def __init__(self, path: Path):
        self.path = path
        self.pairs: List[dict] = []
        self._map: Dict[str, dict] = {}
        self.load()

    def load(self) -> None:
        raw = _load_json(self.path, {"pairs": []})
        self.pairs = raw.get("pairs", []) if isinstance(raw, dict) else []
        self._map = {}
        for p in self.pairs:
            if isinstance(p, dict) and p.get("wrong") and p.get("correct"):
                self._map[str(p["wrong"])] = p
        logger.info("Correction table loaded: %d pairs", len(self._map))

    def __len__(self) -> int:
        return len(self._map)

    def correct_token(self, token: str) -> Tuple[str, Optional[CorrectionApplied]]:
        if token in self._map:
            p = self._map[token]
            return p["correct"], CorrectionApplied(
                wrong=token, correct=p["correct"], source=p.get("source")
            )
        return token, None


# --------------------------------------------------------------------------
# Tokenizer
# --------------------------------------------------------------------------
# Splits on whitespace but keeps trailing punctuation attached to the token so we
# can strip/restore it around lookup. Works for Latin and Devanagari.
_TOKEN_RE = re.compile(r"\S+")
_PUNCT_EDGE = re.compile(r"^([\"'(\[\.!?,;:])*(.*?)([\"')\].!?,;:]*)$", re.UNICODE)


def tokenize(text: str) -> List[str]:
    return [t for t in _TOKEN_RE.findall(text or "") if t.strip()]


def _strip_punct(token: str) -> Tuple[str, str, str]:
    """Return (leading_punct, core, trailing_punct)."""
    m = _PUNCT_EDGE.match(token)
    if not m:
        return "", token, ""
    return m.group(1), m.group(2), m.group(3)


# --------------------------------------------------------------------------
# Engine interface + implementations
# --------------------------------------------------------------------------
class TranslationEngine(ABC):
    """Public boundary for translation. Swap implementations via build_engine()."""

    name: str = "base"

    @abstractmethod
    def translate(self, text: str, source_lang: str = "en") -> TranslationResult:
        ...

    @abstractmethod
    def reload(self) -> None:
        ...


class RuleBasedTranslator(TranslationEngine):
    """Lookup + grammar rules + spelling correction (the default engine)."""

    name = "rule"

    def __init__(self) -> None:
        self.dictionary = Dictionary(settings.dictionary_path)
        self.grammar = GrammarRules(settings.grammar_rules_path)
        self.corrector = SpellingCorrector(settings.corrections_path)

    def reload(self) -> None:
        self.dictionary.load()
        self.grammar.load()
        self.corrector.load()

    # -- language detection (very light heuristic; ASR usually tells us) -----
    @staticmethod
    def detect_lang(text: str) -> str:
        # Any Devanagari codepoint -> Hindi, else English.
        return "hi" if re.search(r"[\u0900-\u097F]", text or "") else "en"

    # ------------------------------------------------------------------ main
    def translate(self, text: str, source_lang: str = "en") -> TranslationResult:
        text = (text or "").strip()
        warnings: List[str] = []
        if not text:
            return TranslationResult(
                source_text="", source_lang=source_lang, warli_text="",
                engine=self.name, warnings=["Empty input text."],
            )

        lang = self.detect_lang(text) if source_lang in ("auto", "", None) else source_lang
        tokens = tokenize(text)

        # 1) LOOKUP (greedy longest phrase match)
        mapped = self._lookup(tokens, lang, warnings)

        # 2) GRAMMAR RULES (reorder + inflection)
        mapped = self._apply_grammar(mapped, tokens, lang)

        # 3) SPELLING CORRECTION / normalization
        mapped, corrections = self._apply_corrections(mapped)

        # Build outputs
        warli_tokens = [m.warli for m in mapped if m.warli]
        warli_text = " ".join(warli_tokens)
        roman_tokens = [m.roman for m in mapped if m.roman]
        warli_roman = " ".join(roman_tokens) if roman_tokens else None
        unmatched = [m.source for m in mapped if not m.matched]

        if unmatched:
            warnings.append(
                f"{len(unmatched)} token(s) had no dictionary match and were passed "
                "through unchanged: " + ", ".join(unmatched[:10])
            )
        if not warli_text:
            warnings.append("No Warli output produced — check dictionary coverage.")

        return TranslationResult(
            source_text=text,
            source_lang=lang,
            warli_text=warli_text,
            warli_roman=warli_roman,
            engine=self.name,
            tokens=mapped,
            unmatched=unmatched,
            corrections_applied=corrections,
            warnings=warnings,
        )

    # -------------------------------------------------------------- 1) lookup
    def _lookup(self, tokens: List[str], lang: str, warnings: List[str]) -> List[MappedToken]:
        mapped: List[MappedToken] = []
        postpositions = self.grammar.postpositions(lang)
        i = 0
        n = len(tokens)
        while i < n:
            matched_span = False
            # Greedy longest phrase match (MAX_PHRASE_WORDS .. 2 words).
            max_words = min(Dictionary.MAX_PHRASE_WORDS, n - i)
            for length in range(max_words, 1, -1):
                raw_span = " ".join(tokens[i:i + length])
                core_words = []
                for t in tokens[i:i + length]:
                    _, core, _ = _strip_punct(t)
                    if core:
                        core_words.append(core)
                norm_span = " ".join(core_words).lower()
                entry = self.dictionary.lookup(norm_span, lang)
                if entry:
                    lead, _, trail = _strip_punct(tokens[i])
                    last_lead, _, last_trail = _strip_punct(tokens[i + length - 1])
                    mapped.append(
                        MappedToken(
                            source=raw_span,
                            warli=str(entry["warli"]),
                            matched=True,
                            pos=entry.get("pos"),
                            roman=entry.get("roman"),
                        )
                    )
                    i += length
                    matched_span = True
                    break
            if matched_span:
                continue

            # Single-word lookup.
            token = tokens[i]
            lead, core, trail = _strip_punct(token)
            entry = self.dictionary.lookup(core, lang) if core else None
            if entry:
                mapped.append(
                    MappedToken(
                        source=token,
                        warli=str(entry["warli"]),
                        matched=True,
                        pos=entry.get("pos"),
                        roman=entry.get("roman"),
                    )
                )
            elif core and core.lower() in postpositions:
                # Relational word -> Warli postposition.
                mapped.append(
                    MappedToken(
                        source=token,
                        warli=postpositions[core.lower()],
                        matched=True,
                        pos="post",
                        is_postposition=True,
                    )
                )
            else:
                # Passthrough (preserve punctuation), flagged unmatched.
                mapped.append(MappedToken(source=token, warli=token, matched=False))
            i += 1
        return mapped

    # ----------------------------------------------------------- 2) grammar
    def _apply_grammar(self, mapped: List[MappedToken], tokens: List[str], lang: str) -> List[MappedToken]:
        result = list(mapped)

        # 2a) Word order: Warli is predominantly SOV. Move verb tokens to the end
        #     while preserving the relative order of everything else. For Hindi
        #     input (already SOV) this is effectively a no-op.
        if self.grammar.target_order == "SOV":
            verbs = [m for m in result if (m.pos == "verb")]
            non_verbs = [m for m in result if m.pos != "verb"]
            if verbs and non_verbs:
                # Only reorder if a verb appears before a non-verb (i.e. SVO-ish).
                first_verb_idx = next(
                    (idx for idx, m in enumerate(result) if m.pos == "verb"), None
                )
                last_nonverb_idx = max(
                    (idx for idx, m in enumerate(result) if m.pos != "verb"), default=-1
                )
                if first_verb_idx is not None and first_verb_idx < last_nonverb_idx:
                    result = non_verbs + verbs

        # 2b) Inflection: detect source cues (is/are/am, was/were) and append the
        #     matching suffix to the LAST verb token. Deliberately simple; refine
        #     against the research papers in grammar_rules.json.
        lowered = [t.lower() for t in tokens] if lang == "en" else list(tokens)
        for rule in self.grammar.cue_rules:
            cues = list(rule.get("match_any_en", []) if lang == "en" else rule.get("match_any_hi", []))
            cues = [c.lower() for c in cues]
            if not any(c in lowered for c in cues):
                continue
            suffix_key = rule.get("apply")
            target_pos = rule.get("to_pos", "verb")
            suffix = self.grammar.inflections.get(suffix_key)
            if not suffix:
                continue
            # Append to the last matching token (do not double-append).
            for m in reversed(result):
                if m.pos == target_pos and not m.warli.endswith(suffix):
                    m.warli = m.warli + suffix
                    break
        return result

    # -------------------------------------------------------- 3) corrections
    def _apply_corrections(self, mapped: List[MappedToken]) -> Tuple[List[MappedToken], List[CorrectionApplied]]:
        corrections: List[CorrectionApplied] = []
        for m in mapped:
            if not m.warli:
                continue
            corrected, applied = self.corrector.correct_token(m.warli)
            if applied:
                m.warli = corrected
                corrections.append(applied)
        return mapped, corrections


# --------------------------------------------------------------------------
# Factory / singleton access
# --------------------------------------------------------------------------
_engine_lock = threading.Lock()
_engine: Optional[TranslationEngine] = None


def build_engine(kind: Optional[str] = None) -> TranslationEngine:
    """Create a translation engine by name.

    To swap in a trained model later, add a new TranslationEngine subclass and
    register it here (e.g. kind == "seq2seq"). Callers/routes stay unchanged.
    """
    kind = (kind or settings.translation_engine or "rule").lower()
    if kind in ("rule", "dictionary", "rule-based"):
        return RuleBasedTranslator()
    if kind in ("seq2seq", "neural", "trained"):
        raise NotImplementedError(
            "Trained seq2seq engine is not wired up yet. Implement a "
            "TranslationEngine subclass and register it in build_engine()."
        )
    logger.warning("Unknown translation engine '%s'; falling back to 'rule'.", kind)
    return RuleBasedTranslator()


def get_engine() -> TranslationEngine:
    """Process-wide lazily-built engine (thread-safe)."""
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = build_engine()
    return _engine


def reload_engine() -> TranslationEngine:
    """Reload data files (dictionary/rules/corrections) without a restart."""
    engine = get_engine()
    engine.reload()
    return engine
