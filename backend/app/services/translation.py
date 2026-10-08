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
                 affixes triggered by source cues (is/are -> present, was -> past,
                 will -> future, not -> negation prefix).
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
from typing import Dict, List, Optional, Set, Tuple

from ..config import settings
from .fuzzy import get_fuzzy

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
    inflected: bool = False  # True once a grammar affix has been attached
    fuzzy_match: Optional[str] = None  # dictionary key used when no exact match existed


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
    target_lang: str = "warli"
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
    """Loads a target-language dictionary JSON and builds fast lookup maps.

    Two source languages are supported (English + Hindi). Phrase keys (multi-word)
    are stored separately from single-word keys so we can do greedy longest-match.

    `word_key` names the target-language headword field in each entry
    ("warli" for Warli). `cognate_key`, when given, indexes an
    extra source map from same-family words (Warli uses "mr": Warli is a
    Marathi-family dialect, so spoken Marathi that equals a Warli headword
    resolves directly).
    """

    MAX_PHRASE_WORDS = 4
    TARGET_HEADWORDS = ("warli",)

    def __init__(self, path: Path, word_key: str = "warli", cognate_key: Optional[str] = "mr"):
        self.path = path
        self.word_key = word_key
        self.cognate_key = cognate_key
        self.entries: List[dict] = []
        # lang -> {normalized key -> entry}
        self._word_maps: Dict[str, Dict[str, dict]] = {"en": {}, "hi": {}, "mr": {}}
        self._phrase_maps: Dict[str, Dict[str, dict]] = {"en": {}, "hi": {}, "mr": {}}
        # single-word Warli headword -> part of speech (see `warli_pos`)
        self._warli_pos: Dict[str, Optional[str]] = {}
        self.load()

    def load(self) -> None:
        raw = _load_json(self.path, {"entries": []})
        self.entries = raw.get("entries", []) if isinstance(raw, dict) else []
        self._word_maps = {"en": {}, "hi": {}, "mr": {}}
        self._phrase_maps = {"en": {}, "hi": {}, "mr": {}}
        self._warli_pos = {}
        for entry in self.entries:
            if not isinstance(entry, dict) or not entry.get(self.word_key):
                continue
            headword = str(entry[self.word_key]).strip()
            if " " not in headword:
                self._warli_pos.setdefault(headword, entry.get("pos"))
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
                if lang == "en" and entry.get("pos") == "verb" and " " not in norm:
                    for variant in self._english_verb_variants(norm):
                        self._word_maps[lang].setdefault(variant, entry)
            # Cognate map (Warli only): index an explicit gloss when present, PLUS
            # Marathi word that equals a Warli headword resolves to that entry (its
            # translation is the same word) — correct for the large shared core
            # vocabulary; anything unmatched still passes through in readable
            # Devanagari. First entry wins for collisions.
            cognate_keys = ([entry.get(self.cognate_key)] if self.cognate_key else []) + [headword]
            for key in cognate_keys:
                if not key:
                    continue
                norm = self._norm_key(str(key))
                if not norm:
                    continue
                if " " in norm:
                    self._phrase_maps["mr"].setdefault(norm, entry)
                else:
                    self._word_maps["mr"].setdefault(norm, entry)
        logger.info(
            "Dictionary loaded: %d entries (%s)", len(self.entries), self.path.name
        )

    @staticmethod
    def _norm_key(text: str) -> str:
        return re.sub(r"\s+", " ", text.strip().lower())

    @staticmethod
    def _english_verb_variants(word: str) -> Set[str]:
        """Return common inflected forms for an English verb headword."""
        if not word or not re.fullmatch(r"[a-z]+", word):
            return set()
        variants: Set[str] = set()
        if word.endswith("y") and len(word) > 2 and word[-2] not in "aeiou":
            stem = word[:-1]
            variants.update({f"{stem}ies", f"{stem}ied", f"{word}ing"})
        elif word.endswith("e"):
            variants.update({f"{word}s", f"{word}d", f"{word[:-1]}ing"})
        else:
            variants.update({f"{word}s", f"{word}es", f"{word}ed", f"{word}ing"})
            # Consonant doubling for CVC verbs (run->running, sit->sitting,
            # swim->swimming, cut->cutting, stop->stopping): without these the
            # -ing form falls through to a verbal-noun entry (pos=noun) or to
            # no match, and the reorderer then strands the verb mid-sentence.
            if (
                len(word) > 2
                and word[-1] not in "aeiouwxy"
                and word[-2] in "aeiou"
                and word[-3] not in "aeiou"
            ):
                variants.update({f"{word}{word[-1]}ing", f"{word}{word[-1]}ed"})
        return variants - {word}

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

    def source_keys(self, lang: str) -> List[str]:
        """All lookup keys (words + phrases) for a source language.

        Used by the fuzzy layer to build its nearest-neighbor index.
        """
        keys = list(self._word_maps.get(lang, {}).keys())
        keys.extend(self._phrase_maps.get(lang, {}).keys())
        return keys

    def warli_pos(self, warli: str) -> Optional[str]:
        """Part of speech of a single-word Warli headword.

        Used to classify multi-word phrase entries: a phrase such as
        "give water" -> "पाणी दे" carries pos="phrase", which says nothing about
        whether it is verbal. Looking at its LAST Warli word resolves that.
        """
        return self._warli_pos.get(str(warli).strip())


class GrammarRules:
    """Word-order + inflection + postposition rules from grammar_rules.json."""

    def __init__(self, path: Path):
        self.path = path
        self.raw: dict = {}
        self._function_words: Dict[str, Set[str]] = {"en": set(), "hi": set(), "mr": set()}
        self.load()

    def load(self) -> None:
        self.raw = _load_json(self.path, {}) or {}
        fw = self.raw.get("function_words", {}) or {}
        self._function_words = {
            lang: {str(w).strip().lower() for w in (fw.get(lang) or []) if str(w).strip()}
            for lang in ("en", "hi", "mr")
        }

    def function_words(self, lang: str) -> Set[str]:
        """Grammatical words with no Warli equivalent (articles, copulas, tense
        auxiliaries). They are dropped from the output instead of being echoed
        back in the source language, but remain available to `cue_rules` because
        those match against the raw source tokens.
        """
        return self._function_words.get(lang, set())

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

    # Parts of speech that occupy Warli's final SOV predicate slot.
    PREDICATE_POS = ("verb", "cop")

    def __init__(self) -> None:
        self.dictionary = Dictionary(settings.dictionary_path)
        self.grammar = GrammarRules(settings.grammar_rules_path)
        self.corrector = SpellingCorrector(settings.corrections_path)
        # Extra target languages can be added here; self.dictionary /
        # self.grammar stay the Warli pair so existing callers (health,
        # /dictionary) keep working.
        self.dictionaries: Dict[str, Dictionary] = {
            "warli": self.dictionary,
        }
        self.grammars: Dict[str, GrammarRules] = {
            "warli": self.grammar,
        }
        # Fuzzy rescue layer (neural meaning + spelling). Warms its indexes in
        # a background thread so boot and first requests never block on ML.
        self._fuzzy = get_fuzzy()
        if settings.fuzzy_enabled:
            for d in self.dictionaries.values():
                self._fuzzy.warm(d)

    #: Target languages selectable via translate(..., target_lang=...).
    TARGET_LANGS = ("warli",)

    def reload(self) -> None:
        self.dictionary.load()
        self.grammar.load()
        self.corrector.load()
        for key, d in self.dictionaries.items():
            if key != "warli":
                d.load()
        for key, g in self.grammars.items():
            if key != "warli":
                g.load()
        # Dictionary content may have changed — drop stale fuzzy indexes.
        try:
            get_fuzzy().invalidate(self.dictionaries["warli"])
        except Exception:
            pass

    # -- language detection (very light heuristic; ASR usually tells us) -----
    # Devanagari is shared by Hindi AND Marathi. Check Marathi markers first
    # (letter ळ, copulas आहे/होता, pronouns मी/माझा, postpositions मध्ये/
    # पासून/साठी) so Marathi input is labelled "mr"; other Devanagari -> "hi".
    _MR_MARKERS = frozenset({
        "आहे", "आहेस", "आहोत", "आहात", "आहेत", "होता", "होती", "होते",
        "होतं", "होतो", "असेल", "असतील", "मी", "माझा", "माझी", "माझे",
        "तुझा", "तुझी", "तुझे", "आम्ही", "तुम्ही", "नाही", "नको",
        "मध्ये", "पासून", "साठी", "मुलगा", "मुलगी", "माणूस",
    })

    @classmethod
    def detect_lang(cls, text: str) -> str:
        if not re.search(r"[\u0900-\u097F]", text or ""):
            return "en"
        if "ळ" in (text or ""):
            return "mr"
        words = {w.strip(" \"'()[]!?.,;:").lower() for w in (text or "").split()}
        if words & cls._MR_MARKERS:
            return "mr"
        return "hi"

    # Devanagari varieties share one script: when the caller asks for Hindi or
    # Marathi (including auto-detected Hindi), consult the other map as well so
    # a Marathi word typed under auto/Hindi still resolves, and vice versa.
    _DEVANAGARI_FALLBACK = {"hi": "mr", "mr": "hi"}

    def _lookup_entry(self, dictionary: Dictionary, span: str, lang: str) -> Optional[dict]:
        entry = dictionary.lookup(span, lang)
        if entry is None:
            fallback = self._DEVANAGARI_FALLBACK.get(lang)
            if fallback:
                entry = dictionary.lookup(span, fallback)
        return entry

    # ------------------------------------------------------------------ main
    def translate(self, text: str, source_lang: str = "en", target_lang: str = "warli") -> TranslationResult:
        text = (text or "").strip()
        warnings: List[str] = []
        if target_lang not in self.TARGET_LANGS:
            warnings.append(
                f"Unknown target language '{target_lang}'; falling back to Warli."
            )
            target_lang = "warli"
        dictionary = self.dictionaries[target_lang]
        grammar = self.grammars[target_lang]
        if not text:
            return TranslationResult(
                source_text="", source_lang=source_lang, target_lang=target_lang,
                warli_text="", engine=self.name, warnings=["Empty input text."] + warnings,
            )

        lang = self.detect_lang(text) if source_lang in ("auto", "", None) else source_lang
        tokens = tokenize(text)

        # 1) LOOKUP (greedy longest phrase match)
        mapped = self._lookup(tokens, lang, warnings, dictionary, grammar)

        # 2) GRAMMAR RULES (reorder + inflection)
        mapped = self._apply_grammar(mapped, tokens, lang, grammar, dictionary)

        # 3) SPELLING CORRECTION / normalization (Warli correction table).
        if target_lang == "warli":
            mapped, corrections = self._apply_corrections(mapped)
        else:
            corrections = []

        # Build outputs
        warli_tokens = [m.warli for m in mapped if m.warli]
        warli_text = " ".join(warli_tokens)
        roman_tokens = [m.roman for m in mapped if m.roman]
        warli_roman = " ".join(roman_tokens) if roman_tokens else None
        unmatched = [m.source for m in mapped if not m.matched]
        fuzzy_used = [(m.source, m.fuzzy_match) for m in mapped if m.fuzzy_match]

        if fuzzy_used:
            warnings.append(
                "No exact match — closest meaning used: "
                + ", ".join(f"'{s}' → '{k}'" for s, k in fuzzy_used[:6])
            )

        if unmatched:
            warnings.append(
                f"{len(unmatched)} token(s) had no dictionary match and were passed "
                "through unchanged: " + ", ".join(unmatched[:10])
            )
        if not warli_text:
            warnings.append(f"No {target_lang.title()} output produced — check dictionary coverage.")

        return TranslationResult(
            source_text=text,
            source_lang=lang,
            target_lang=target_lang,
            warli_text=warli_text,
            warli_roman=warli_roman,
            engine=self.name,
            tokens=mapped,
            unmatched=unmatched,
            corrections_applied=corrections,
            warnings=warnings,
        )

    # -------------------------------------------------------------- 1) lookup
    def _fuzzy_lookup(self, dictionary: Dictionary, core: str, lang: str):
        """Best-effort rescue for tokens with no exact match.

        Returns (dictionary_key, method) or None. Gated on the feature flag;
        never raises (a fuzzy failure must never break translation).
        """
        if not settings.fuzzy_enabled:
            return None
        if not core or not re.fullmatch(r"[A-Za-z\u0900-\u097F]+", core):
            return None
        try:
            return self._fuzzy.suggest(dictionary, core, lang)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Fuzzy lookup failed: %s", exc)
            return None

    def _lookup(self, tokens: List[str], lang: str, warnings: List[str],
                dictionary: Dictionary, grammar: GrammarRules) -> List[MappedToken]:
        mapped: List[MappedToken] = []
        postpositions = grammar.postpositions(lang)
        function_words = grammar.function_words(lang)
        if lang in self._DEVANAGARI_FALLBACK:
            # Hindi and Marathi share Devanagari: merge the sibling sets so a
            # Marathi copula/postposition typed under auto(=hi) still drops or
            # maps correctly, and vice versa. English stays strictly separate.
            sibling = self._DEVANAGARI_FALLBACK[lang]
            function_words = function_words | grammar.function_words(sibling)
            postpositions = {**grammar.postpositions(sibling), **postpositions}
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
                entry = self._lookup_entry(dictionary, norm_span, lang)
                if entry:
                    lead, _, trail = _strip_punct(tokens[i])
                    last_lead, _, last_trail = _strip_punct(tokens[i + length - 1])
                    mapped.append(
                        MappedToken(
                            source=raw_span,
                            warli=str(entry[dictionary.word_key]),
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
            # Drop standalone function words (articles, copulas, tense auxiliaries).
            # They have no Warli equivalent and are already consumed as inflection
            # cues; echoing them leaked English words into the Warli output and let
            # the copula pick up a tense suffix ("is" -> "आहेता"). This runs AFTER
            # phrase matching, so multi-word entries like "how are you" still
            # resolve as a whole instead of losing their middle word.
            if core and core.lower() in function_words:
                i += 1
                continue
            entry = self._lookup_entry(dictionary, core, lang) if core else None
            if entry:
                mapped.append(
                    MappedToken(
                        source=token,
                        warli=str(entry[dictionary.word_key]),
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
                # No exact match: ask the fuzzy layer (neural meaning, then
                # spelling) before giving up to passthrough.
                fuzzy_hit = self._fuzzy_lookup(dictionary, core, lang) if core else None
                if fuzzy_hit is not None:
                    key, method, _score = fuzzy_hit
                    entry = dictionary.lookup(key, lang)
                    mapped.append(MappedToken(
                        source=token,
                        warli=str(entry[dictionary.word_key]),
                        matched=True,
                        pos=entry.get("pos"),
                        roman=entry.get("roman"),
                        fuzzy_match=f"{key} ({method})",
                    ))
                else:
                    # Passthrough (preserve punctuation), flagged unmatched.
                    mapped.append(MappedToken(source=token, warli=token, matched=False))
            i += 1
        return mapped

    # ----------------------------------------------------------- 2) grammar
    def _is_predicate(self, m: MappedToken, dictionary: Dictionary) -> bool:
        """True if this token belongs in Warli's final predicate slot.

        Lexical verbs and the copula qualify directly. A multi-word phrase entry
        qualifies when its LAST Warli word is verbal — "give water" -> "पाणी दे"
        must move to the end, but a nominal phrase must not. Without this the
        ~500 pos="phrase" dictionary entries were invisible to the reorderer, so
        any sentence that matched one kept its source word order entirely.
        """
        if m.pos in self.PREDICATE_POS:
            return True
        if m.pos == "phrase" and m.warli and " " in m.warli:
            return dictionary.warli_pos(m.warli.split()[-1]) in self.PREDICATE_POS
        return False

    def _apply_grammar(self, mapped: List[MappedToken], tokens: List[str], lang: str,
                       grammar: GrammarRules, dictionary: Dictionary) -> List[MappedToken]:
        result = list(mapped)

        # 2a) Word order: Warli is predominantly SOV. Move predicate tokens to the
        #     end while preserving the relative order of everything else. For Hindi
        #     input (already SOV) this is effectively a no-op.
        #
        #     A predicate is either a lexical verb (pos="verb") or the copula
        #     (pos="cop", Warli "हाय"), so "I have money" -> "मी पैसे हाय".
        #     The copula is deliberately EXCLUDED from the inflection step below
        #     (cue rules target to_pos="verb"); that is what stops the perfective
        #     cue on "have" from gluing a suffix onto it ("आहे" -> "आहेलं").
        if grammar.target_order == "SOV":
            is_pred = [self._is_predicate(m, dictionary) for m in result]
            preds = [m for m, p in zip(result, is_pred) if p]
            others = [m for m, p in zip(result, is_pred) if not p]
            # English uses prepositions ("to the child") but Warli uses
            # postpositions ("पोर कडे" — child-to). For English input only
            # (Hindi/Marathi already place them after the noun), move each
            # postposition token after the next non-predicate token.
            if lang == "en":
                moved: List[MappedToken] = []
                pending: List[MappedToken] = []
                # Source words that are relational in English (keys of the en
                # postposition map) count as postpositional even when they
                # resolved via the dictionary under another pos (e.g. "under"
                # stored as an adverb still means "झाड खाली", tree-under).
                relational = {str(k).lower() for k in grammar.postpositions("en")}
                for m in others:
                    _, src_core, _ = _strip_punct(m.source)
                    # pos == "post" covers relational words that resolved via
                    # the dictionary (e.g. "to" -> "कडे") rather than the
                    # postposition map, which never sets is_postposition.
                    if m.is_postposition or m.pos == "post" or src_core.lower() in relational:
                        pending.append(m)
                    else:
                        moved.append(m)
                        moved.extend(pending)
                        pending = []
                moved.extend(pending)
                others = moved
            # Only reorder if a predicate appears before a non-predicate (SVO-ish).
            if preds and others:
                first_pred_idx = is_pred.index(True)
                last_other_idx = max(
                    (idx for idx, p in enumerate(is_pred) if not p), default=-1
                )
                if first_pred_idx < last_other_idx:
                    result = others + preds
                else:
                    # Predicate already final, but the postposition fix above
                    # may still have reordered `others` — write it back.
                    it = iter(others)
                    result = [next(it) if not p else m for m, p in zip(result, is_pred)]
            elif others:
                # No predicate at all (e.g. a mistagged verb): the postposition
                # fix may still have reordered everything.
                result = others

        # 2b) Inflection: detect source cues (is/are/am, was/were, will, not...)
        #     and attach the matching affix to the LAST eligible token.
        #     Affix keys ending in `_prefix` are prepended (negation -> "नाही कर");
        #     everything else is appended (future -> "कर" + "ईल" = "करईल").
        #     Deliberately simple; refine against the research papers.
        lowered = [t.lower() for t in tokens] if lang == "en" else list(tokens)
        sibling_cue_lang = self._DEVANAGARI_FALLBACK.get(lang)
        for rule in grammar.cue_rules:
            cues = [str(c).lower() for c in (rule.get(f"match_any_{lang}") or [])]
            if sibling_cue_lang:
                # A Devanagari cue (e.g. Marathi आहे under auto-detected Hindi)
                # must still trigger the matching inflection.
                cues += [str(c).lower() for c in (rule.get(f"match_any_{sibling_cue_lang}") or [])]
            if not any(c in lowered for c in cues):
                continue
            affix_key = str(rule.get("apply") or "")
            target_pos = rule.get("to_pos", "verb")
            affix = grammar.inflections.get(affix_key)
            if not affix:
                continue
            is_prefix = affix_key.endswith("_prefix")
            # Skip the whole rule if the affix is already present as its own
            # token — "I do not know" matches "not" -> "नाही" during lookup, so
            # affixing the verb as well would emit "... नाही नाही जाण".
            if any(m.warli == affix for m in result):
                continue
            for m in reversed(result):
                if m.pos != target_pos:
                    continue
                # Only inflect real dictionary words. Postpositions ("कडे", "मादे")
                # and unmatched passthrough tokens must stay untouched, otherwise
                # they pick up nonsense affixes (e.g. "घरात" + plural marker).
                if not m.matched or m.is_postposition:
                    continue
                # Tense/aspect cues are alternatives, not cumulative: one affix
                # per token, so "was ... not" cannot stack into "करला नाहीला".
                if m.inflected:
                    continue
                already = m.warli.startswith(affix) if is_prefix else m.warli.endswith(affix)
                if already:
                    continue
                m.warli = affix + m.warli if is_prefix else m.warli + affix
                m.inflected = True
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
