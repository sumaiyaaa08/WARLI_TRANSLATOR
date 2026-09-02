"""FastAPI application entrypoint for the Warli Speech Translator.

Run locally:
    uvicorn app.main:app --reload        (from the backend/ folder)
Then open http://127.0.0.1:8000/docs for interactive API docs.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.errors import register_error_handlers
from .api.routes import router
from .config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("warli.main")

app = FastAPI(
    title="Warli Speech Translator API",
    version="1.0.0",
    description=(
        "Translate spoken/written English or Hindi into Warli (Devanagari, Palghar "
        "dialect). Pipeline: ASR (Whisper) -> rule-based translation (dictionary + "
        "grammar rules + spelling correction) -> optional TTS (Hindi/Marathi voice "
        "reading Warli text, an APPROXIMATION — no true Warli TTS model exists)."
    ),
)

# CORS so the React dev server can call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)
app.include_router(router, tags=["warli"])


@app.on_event("startup")
def _startup() -> None:
    # Build the translation engine eagerly so data-load errors surface at boot
    # (ASR/TTS models stay lazy — they are heavy and only needed on demand).
    from .services.translation import get_engine

    engine = get_engine()
    logger.info(
        "Warli API ready. engine=%s | data_dir=%s",
        engine.name, settings.data_dir,
    )


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {
        "service": "Warli Speech Translator API",
        "docs": "/docs",
        "health": "/health",
    }
