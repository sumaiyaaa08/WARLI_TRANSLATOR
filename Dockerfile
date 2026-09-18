# syntax=docker/dockerfile:1
# Warli Speech Translator — ONE image that builds the React frontend and runs the
# FastAPI backend. The backend serves BOTH the JSON API (under /api) and the built
# SPA (at /), so the whole product deploys to a single server/origin — no separate
# frontend host and no cross-origin CORS hop. Deployable to Render (see render.yaml),
# Railway, Fly.io, or any VPS with Docker.
#
# Build & run locally:
#   docker build -t warli .
#   docker run --rm -p 8000:8000 warli      # then open http://localhost:8000

# ---- Stage 1: build the frontend (Vite -> static dist/) --------------------
FROM node:20-alpine AS web
WORKDIR /web
# Install deps first for better layer caching; package-lock.json enables `npm ci`.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Python runtime serving the API + the built frontend ----------
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/huggingface
# libgomp1: OpenMP runtime that some ML wheels expect at import time.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*

# Backend dependencies.
COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# App code + runtime data assets (dictionary / grammar / corrections / pronunciation).
COPY backend/ ./backend/
COPY data/ ./data/
# The built SPA, served by FastAPI at "/" (config.py resolves frontend/dist).
COPY --from=web /web/dist ./frontend/dist

# Pre-download the default ASR model INTO the image so cold starts don't re-fetch
# it (Render's free-tier disk is ephemeral — this is the main "slow server" fix).
# Fails soft if there is no network at build time; it then downloads on first use.
ARG ASR_MODEL=tiny
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${ASR_MODEL}', device='cpu', compute_type='int8')" \
 || echo "ASR pre-download skipped (will fetch on first request instead)"

# Pre-download the fuzzy-lookup embedding model (same ephemeral-disk reason).
# Soft-fails the same way; without it, only the spelling fallback runs.
ARG FUZZY_MODEL=paraphrase-multilingual-MiniLM-L12-v2
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${FUZZY_MODEL}')" \
 || echo "Fuzzy model pre-download skipped (spelling fallback still works)"

# Render/other PaaS inject $PORT; default to 8000 for local `docker run`.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --app-dir backend"]
