"""Central configuration for the Warli translator backend.

All tunable paths / feature flags live here and can be overridden with
environment variables so the same code runs in dev and on a deployment box.
Nothing dictionary-specific is hardcoded in the service modules — they read the
paths resolved here.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


# backend/app/config.py -> backend/app -> backend -> project root
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_PROJECT_ROOT = _BACKEND_DIR.parent


@dataclass
class Settings:
    # --- Data locations (top-level /data folder by default) -------------------
    project_root: Path = field(default_factory=lambda: _PROJECT_ROOT)
    data_dir: Path = field(
        default_factory=lambda: Path(
            os.getenv("WARLI_DATA_DIR", str(_PROJECT_ROOT / "data"))
        )
    )

    # --- ASR (speech -> English/Hindi text) ----------------------------------
    # Whisper is used for input ASR. We default to `faster-whisper` because it is
    # CPU friendly and installs without a heavy torch dependency. The model is
    # loaded lazily on first use so the API boots fast.
    asr_enabled: bool = field(default_factory=lambda: _env_bool("WARLI_ASR_ENABLED", True))
    asr_backend: str = field(default_factory=lambda: os.getenv("WARLI_ASR_BACKEND", "faster-whisper"))
    asr_model_size: str = field(default_factory=lambda: os.getenv("WARLI_ASR_MODEL", "small"))
    asr_device: str = field(default_factory=lambda: os.getenv("WARLI_ASR_DEVICE", "cpu"))
    asr_compute_type: str = field(default_factory=lambda: os.getenv("WARLI_ASR_COMPUTE", "int8"))

    # --- Translation engine --------------------------------------------------
    # Swap "rule" for a future trained engine (e.g. "seq2seq") without touching
    # route handlers — see services/translation.py:build_engine().
    translation_engine: str = field(default_factory=lambda: os.getenv("WARLI_TRANSLATION_ENGINE", "rule"))

    # --- Fuzzy lookup (neural semantic + spelling fallback) -------------------
    # Rescues near-misses ("infant" -> "child") when exact lookup fails. The
    # neural layer needs its model cached (Dockerfile pre-downloads it); without
    # it, only the stdlib spelling layer runs. Every hit is flagged in warnings.
    fuzzy_enabled: bool = field(default_factory=lambda: _env_bool("WARLI_FUZZY_ENABLED", True))
    fuzzy_model: str = field(
        default_factory=lambda: os.getenv(
            "WARLI_FUZZY_MODEL", "paraphrase-multilingual-MiniLM-L12-v2"))
    fuzzy_threshold: float = field(
        default_factory=lambda: _env_float("WARLI_FUZZY_THRESHOLD", 0.60))

    # --- TTS (Warli text -> audio, Speech->Warli Speech mode) ----------------
    # NOTE: This is an APPROXIMATION. There is no Warli TTS model; we use a
    # Hindi/Marathi voice (gTTS) to read Devanagari Warli text. Flagged clearly
    # in services/tts.py and the API response metadata.
    tts_enabled: bool = field(default_factory=lambda: _env_bool("WARLI_TTS_ENABLED", True))
    # Warli (Varli) is an Indo-Aryan language usually classified as a Marathi
    # dialect, so a Marathi voice reads Warli Devanagari noticeably more accurately
    # than a Hindi voice (e.g. it keeps the retroflex ळ/ण and Marathi vowel lengths).
    # Default 'mr'; set WARLI_TTS_LANG=hi to fall back to the Hindi voice.
    tts_voice_lang: str = field(default_factory=lambda: os.getenv("WARLI_TTS_LANG", "mr"))  # 'mr' (default) or 'hi'
    tts_slow: bool = field(default_factory=lambda: _env_bool("WARLI_TTS_SLOW", False))

    # --- Optional pronunciation fine-tuning module ---------------------------
    # Fully decoupled. If disabled or the lexicon is empty, TTS reads text as-is.
    pronunciation_enabled: bool = field(
        default_factory=lambda: _env_bool("WARLI_PRONUNCIATION_ENABLED", True)
    )

    # --- API / CORS ----------------------------------------------------------
    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip()
            for o in os.getenv(
                "WARLI_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
            ).split(",")
            if o.strip()
        ]
    )
    max_upload_bytes: int = field(
        default_factory=lambda: _env_int("WARLI_MAX_UPLOAD_BYTES", 25 * 1024 * 1024)
    )

    # --- API prefix / single-server frontend --------------------------------
    # Every JSON endpoint is served under this prefix (default "/api", e.g.
    # /api/translate/text, /api/health). That frees "/" to serve the built React
    # app from the SAME process/origin, so the whole product deploys to one
    # server (no separate frontend host, no cross-origin CORS hop).
    api_prefix: str = field(default_factory=lambda: os.getenv("WARLI_API_PREFIX", "/api"))

    # --- Derived data file paths ---------------------------------------------
    @property
    def dictionary_path(self) -> Path:
        return self.data_dir / "warli_dictionary" / "warli_dictionary.json"

    @property
    def grammar_rules_path(self) -> Path:
        return self.data_dir / "warli_dictionary" / "grammar_rules.json"

    @property
    def corrections_path(self) -> Path:
        return self.data_dir / "voice_recording" / "corrections.json"
    @property
    def pronunciation_lexicon_path(self) -> Path:
        return self.data_dir / "pronunciation_audio" / "lexicon.json"

    @property
    def frontend_dist(self) -> Path:
        """Built React app (frontend/dist). Served at "/" when present so the API
        and UI run on one origin. Override with WARLI_FRONTEND_DIST."""
        return Path(
            os.getenv("WARLI_FRONTEND_DIST", str(_PROJECT_ROOT / "frontend" / "dist"))
        )


settings = Settings()
