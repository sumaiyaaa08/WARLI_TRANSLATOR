"""FastAPI application entrypoint for the Warli Speech Translator.

Single-server design: this one process serves BOTH the JSON API (under
`settings.api_prefix`, default `/api`) and the built React app (from
`frontend/dist`, mounted at `/`). Deploy it once (see the root `Dockerfile` /
`render.yaml`) and the UI + API share an origin — no separate frontend host and
no cross-origin CORS hop.

Run locally:
    uvicorn app.main:app --reload        (from the backend/ folder)
Then open http://127.0.0.1:8000/docs for interactive API docs. In dev you usually
run the Vite server on :5173 (it proxies /api here) and don't need a build.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

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
    version="1.1.0",
    description=(
        "Translate spoken/written English, Hindi or Marathi into Warli (Devanagari, "
        "Palghar dialect). Pipeline: ASR (Whisper) -> rule-based translation "
        "(dictionary + grammar rules + spelling correction) -> optional TTS "
        "(Marathi voice reading Warli text, an APPROXIMATION — no true Warli TTS "
        "model exists). The same server also hosts the React UI at /."
    ),
)

# CORS: with the UI served from this same origin it is not strictly required, but
# keeping it lets a separate dev/preview frontend still call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)
# All JSON endpoints live under /api (e.g. /api/translate/text, /api/health).
app.include_router(router, prefix=settings.api_prefix, tags=["warli"])
from .api.learning_routes import learning_router
app.include_router(learning_router, prefix=settings.api_prefix, tags=["learning"])
from .api.auth_routes import auth_router
app.include_router(auth_router, prefix=settings.api_prefix, tags=["auth"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Build the translation engine eagerly so data-load errors surface at boot
    # (ASR/TTS models stay lazy — they are heavy and only needed on demand).
    from .services.translation import get_engine

    engine = get_engine()
    logger.info(
        "Warli API ready. engine=%s | api_prefix=%s | data_dir=%s",
        engine.name, settings.api_prefix, settings.data_dir,
    )
    yield


app.router.lifespan_context = lifespan


# Serve the built React app from the SAME process when a build is present. Mounted
# LAST so /api/*, /docs and /openapi.json (registered above) take precedence;
# html=True makes "/" return index.html. When there is no build (typical dev), we
# fall back to a small JSON landing page and the Vite dev server is used instead.
_dist = settings.frontend_dist
if _dist.is_dir() and (_dist / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="frontend")
    logger.info("Serving frontend SPA from %s", _dist)
else:
    logger.warning(
        "Frontend build not found at %s — running API-only. Build it with "
        "`cd frontend && npm run build` (the Docker image does this automatically).",
        _dist,
    )

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {
            "service": "Warli Speech Translator API",
            "docs": "/docs",
            "health": f"{settings.api_prefix}/health",
            "note": "No frontend build present; serving API only.",
        }
