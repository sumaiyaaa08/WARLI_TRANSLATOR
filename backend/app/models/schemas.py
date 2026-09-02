"""Request / response schemas (Pydantic v2).

These define the public API contract. The translation *engine* returns a plain
dataclass (`TranslationResult`) which the route layer maps into the response
models below — keeping the service independent of FastAPI/HTTP concerns.
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class SourceLanguage(str, Enum):
    """Supported *input* languages (what the user speaks)."""

    en = "en"
    hi = "hi"
    auto = "auto"  # let ASR / heuristics decide


class OutputMode(str, Enum):
    """What the caller wants back."""

    text = "text"    # Speech/Text -> Warli text only
    speech = "speech"  # also synthesize Warli audio (approximation)


# --------------------------------------------------------------------------
# Requests
# --------------------------------------------------------------------------
class TextTranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Source text in English or Hindi.")
    source_lang: SourceLanguage = Field(
        SourceLanguage.en, description="Input language; 'auto' runs a light heuristic."
    )
    output_mode: OutputMode = Field(
        OutputMode.text, description="'speech' also returns synthesized Warli audio."
    )


# /translate/speech is multipart/form-data (audio file + fields), handled with
# Form() params in the route — no request body model needed there.


# --------------------------------------------------------------------------
# Responses
# --------------------------------------------------------------------------
class TokenTranslation(BaseModel):
    """Per-token mapping, useful for debugging and for the UI to highlight
    which words had no dictionary match."""

    source: str
    warli: str
    matched: bool
    pos: Optional[str] = None
    roman: Optional[str] = None


class CorrectionApplied(BaseModel):
    wrong: str
    correct: str
    source: Optional[str] = None


class TTSMeta(BaseModel):
    """Explicitly flags that Warli speech is an APPROXIMATION, not a real
    Warli voice model. Surfaced to the UI so users are never misled."""

    generated: bool = False
    approximation: bool = True
    voice_lang: Optional[str] = None
    pronunciation_layer_applied: bool = False
    note: str = (
        "No Warli TTS model exists. Audio is synthesized by a Hindi/Marathi voice "
        "reading the Devanagari Warli text — an approximation of Warli pronunciation."
    )


class TranslationResponse(BaseModel):
    source_text: str
    source_lang: SourceLanguage
    warli_text: str
    warli_roman: Optional[str] = None
    engine: str
    tokens: List[TokenTranslation] = Field(default_factory=list)
    unmatched: List[str] = Field(default_factory=list)
    corrections_applied: List[CorrectionApplied] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    output_mode: OutputMode = OutputMode.text
    tts: Optional[TTSMeta] = None
    audio_base64: Optional[str] = Field(
        None, description="Warli speech (mp3) as base64, only when output_mode='speech'."
    )
    audio_mime: Optional[str] = None


class DictionaryEntry(BaseModel):
    warli: str
    roman: Optional[str] = None
    en: Optional[str] = None
    hi: Optional[str] = None
    pos: Optional[str] = None
    example: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class DictionaryResponse(BaseModel):
    count: int
    q: Optional[str] = None
    source_lang: Optional[str] = None
    entries: List[DictionaryEntry] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str = "ok"
    translation_engine: str
    dictionary_entries: int
    correction_pairs: int
    pronunciation_entries: int
    asr_enabled: bool
    tts_enabled: bool


class ReloadResponse(BaseModel):
    status: str = "reloaded"
    dictionary_entries: int
    correction_pairs: int
    pronunciation_entries: int


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
