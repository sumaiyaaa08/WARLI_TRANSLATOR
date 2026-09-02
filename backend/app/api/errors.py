"""Consistent JSON error handling for the API layer.

Every user-facing failure returns the same shape:
    { "error": "<short code>", "detail": "<human readable>" }
with an appropriate HTTP status, so the frontend can branch on `error`.
"""
from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def _json(status_code: int, error: str, detail: str | None = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": error, "detail": detail})


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return _json(exc.status_code, "http_error", str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        # Surface the first validation problem as a readable detail.
        errors = exc.errors()
        detail = None
        if errors:
            first = errors[0]
            loc = ".".join(str(x) for x in first.get("loc", []) if x != "body")
            detail = f"{loc}: {first.get('msg')}" if loc else first.get("msg")
        return _json(status.HTTP_422_UNPROCESSABLE_ENTITY, "validation_error", detail)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        # Last resort — never leak stack traces to the client.
        return _json(status.HTTP_500_INTERNAL_SERVER_ERROR, "internal_error", str(exc))
