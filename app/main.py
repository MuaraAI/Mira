import asyncio
import os
import secrets
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.cache import cache
from app.limiter import limiter
from app.envelope import error_response, success_response
from app.docs import get_api_docs
from app.router_helper import close_background_tasks
from app.modules.studentv2 import router as studentv2_router, studentv2_client
from app.modules.elearning import router as elearning_router, pooled_elearning_client
from app.modules.elibrary import router as elibrary_router
from app.modules.news import router as news_router
from app.modules.repository import router as repository_router
from app.modules.ejournal import router as ejournal_router
from app.modules.auth import router as auth_router
from app.modules.channels import router as channels_router
from app.modules.pwa_push import router as pwa_push_router
from app.modules.links import router as links_router
from app.modules.stats import router as stats_router
from app.stats import record_request, record_profile

def extract_client_ip(request: Request) -> str:
    """Ekstraksi IP klien dengan prioritas Cloudflare -> Forwarded Proxy -> socket host.

    Header forwarding hanya dipercaya jika request berasal dari host terpercaya (TRUSTED_PROXIES).
    """
    client_host = request.client.host if (request.client and request.client.host) else "127.0.0.1"
    trusted = {p.strip() for p in settings.TRUSTED_PROXIES.split(",") if p.strip()}

    if client_host in trusted:
        cf_ip = request.headers.get("cf-connecting-ip")
        if cf_ip:
            return cf_ip.strip()
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()

    return client_host

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    if not settings.API_KEY and not os.getenv("PYTEST_CURRENT_TEST"):
        raise RuntimeError("API_KEY wajib disetel di file .env!")

    try:
        from app.channels_db import init_db
        from app.api_keys_db import init_api_keys_db
        from app.pwa_push_db import init_pwa_db

        init_db()
        init_api_keys_db()
        init_pwa_db()
    except Exception:
        pass

    async def _eviction_worker():
        while True:
            await asyncio.sleep(300)
            try:
                await studentv2_client.evict_idle()
                await pooled_elearning_client.evict_idle()
            except Exception:
                pass

    eviction_task = None
    news_task = None
    realtime_task = None
    if not os.getenv("PYTEST_CURRENT_TEST"):
        eviction_task = asyncio.create_task(_eviction_worker())
        from app.modules.news import news_webhook_worker
        news_task = asyncio.create_task(news_webhook_worker())
        from app.notifier import realtime_notification_worker
        realtime_task = asyncio.create_task(realtime_notification_worker())

    yield

    if realtime_task:
        realtime_task.cancel()
        try:
            await realtime_task
        except asyncio.CancelledError:
            pass

    if news_task:
        news_task.cancel()
        try:
            await news_task
        except asyncio.CancelledError:
            pass

    if eviction_task:
        eviction_task.cancel()
        try:
            await eviction_task
        except asyncio.CancelledError:
            pass

    try:
        await close_background_tasks()
        await studentv2_client.close()
        await pooled_elearning_client.close()
        if cache._client is not None:
            await cache._client.aclose()
        if limiter._client is not None:
            await limiter._client.aclose()
        from app.session_store import session_store
        await session_store.close()
    except Exception:
        pass

app = FastAPI(
    title="UBSI API",
    description="Private Unofficial API Aggregator for UBSI Services",
    version="1.1.7",
    root_path=settings.ROOT_PATH,
    lifespan=lifespan
)

app.include_router(studentv2_router)
app.include_router(elearning_router)
app.include_router(elibrary_router)
app.include_router(news_router)
app.include_router(repository_router)
app.include_router(ejournal_router)
app.include_router(auth_router)
app.include_router(channels_router)
app.include_router(pwa_push_router)
app.include_router(links_router)
app.include_router(stats_router)

@app.middleware("http")
async def api_key_auth_middleware(request: Request, call_next):
    if getattr(request.state, "_auth_ran", False):
        return await call_next(request)
    request.state._auth_ran = True
    # 1. Allow OPTIONS (CORS preflight)
    if request.method == "OPTIONS":
        return await call_next(request)

    # 2. Allow /health + /v1/auth/login + /v1/docs without auth (resilient to trailing slash)
    # /v1/notifications/pwa/vapid-key publik: browser butuh kunci ini SEBELUM auth ada
    public_paths = {"/health", "/v1/auth/login", "/v1/stats", "/v1/docs", "/v1/notifications/pwa/vapid-key"}
    if request.url.path.rstrip("/") in public_paths:
        return await call_next(request)

    # 3a. Extract candidate tokens from Authorization Bearer, cookies, or X-API-Key
    auth_header = request.headers.get("authorization", "")
    bearer_token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else ""
    raw_api_key = request.headers.get("x-api-key")
    api_key = raw_api_key.strip() if raw_api_key else ""
    cookie_token = request.cookies.get("ubsi_session", "")

    # 3b. Personal API Key check (prefix: muara_mira_ or legacy muara_ubsi_)
    candidate_api_key = ""
    if bearer_token.startswith(("muara_mira_", "muara_ubsi_")):
        candidate_api_key = bearer_token
    elif api_key.startswith(("muara_mira_", "muara_ubsi_")):
        candidate_api_key = api_key

    if candidate_api_key:
        from app.api_keys_db import resolve_api_key

        key_data = await resolve_api_key(candidate_api_key)
        if key_data:
            request.state.is_master = False
            request.state.key_id = f"apikey:{key_data['nim']}"
            request.state.nim = key_data["nim"]
            request.state.studentv2_pass = key_data["studentv2_pass"]
            request.state.elearning_pass = key_data["elearning_pass"]
            request.state.auth_type = "api_key"
            return await call_next(request)
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=error_response(
                code="UNAUTHORIZED",
                message="Akses ditolak: API Key tidak valid atau telah dinonaktifkan.",
                module="auth",
            ),
        )

    # 3c. Session token (dashboard login BSI): Authorization Bearer ATAU cookie
    # Master key via Bearer is accepted before treating it as a session token.
    if bearer_token and settings.API_KEY and secrets.compare_digest(bearer_token, settings.API_KEY):
        request.state.is_master = True
        request.state.key_id = "master"
        request.state.auth_type = "master"
        return await call_next(request)

    # Ambient cookie auth is ONLY accepted from the official dashboard frontend
    # (prevents raw browser address bar navigation from accessing API without explicit key/token)
    origin = request.headers.get("origin") or ""
    referer = request.headers.get("referer") or ""
    referer_origin = ""
    if referer:
        try:
            import urllib.parse
            parsed_ref = urllib.parse.urlparse(referer)
            if parsed_ref.scheme and parsed_ref.netloc:
                referer_origin = f"{parsed_ref.scheme}://{parsed_ref.netloc}"
        except Exception:
            pass

    allowed_set = {o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip() and o.strip() != "*"}
    allowed_set.add("https://mira.muaraai.com")
    allowed_set.add("https://ubsi-api.muaraai.com")
    allowed_set.add("http://localhost:3000")
    is_dashboard_request = (
        request.headers.get("x-requested-with") == "dashboard"
        or (origin and (origin in allowed_set or "*" in settings.ALLOWED_ORIGINS))
        or (referer_origin and (referer_origin in allowed_set or "*" in settings.ALLOWED_ORIGINS))
    )
    effective_cookie_token = cookie_token if is_dashboard_request else ""

    session_token = bearer_token or effective_cookie_token
    if session_token:
        from app.session_store import session_store

        session_data = await session_store.resolve(session_token)
        if session_data:
            request.state.is_master = False
            request.state.key_id = "session:" + session_token[:8]
            request.state.nim = session_data["nim"]
            request.state.elearning_pass = session_data["elearning_pass"]
            request.state.studentv2_pass = session_data["studentv2_pass"]
            request.state.auth_type = "session"
            return await call_next(request)
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=error_response(
                code="SESSION_EXPIRED",
                message="Session kedaluwarsa. Silakan login kembali.",
                module="auth",
            ),
        )

    # 3d. Master Key check via X-API-Key
    if not api_key:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=error_response(
                code="UNAUTHORIZED",
                message="Akses ditolak: Header X-API-Key atau Authorization Bearer tidak valid",
                module="auth",
            ),
        )

    configured_key = settings.API_KEY
    if configured_key and secrets.compare_digest(api_key, configured_key):
        request.state.is_master = True
        request.state.key_id = "master"
        request.state.auth_type = "master"
        return await call_next(request)

    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content=error_response(
            code="UNAUTHORIZED",
            message="Akses ditolak: Header X-API-Key tidak valid atau tidak disertakan",
            module="auth",
        ),
    )

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    async def after_auth(authorized_request: Request):
        path = authorized_request.url.path.rstrip("/")
        if authorized_request.method == "OPTIONS" or path in ("/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(authorized_request)
        client_key = getattr(authorized_request.state, "key_id", None)
        is_write_route = authorized_request.method in {"POST", "PUT", "PATCH", "DELETE"} and (
            "/elearning/presence" in path or "/elearning/assignments/" in path
        )
        if is_write_route:
            rate_identifier = f"write:{client_key or extract_client_ip(authorized_request)}"
            if not await limiter.is_allowed(rate_identifier, limit=5):
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content=error_response(
                        code="WRITE_RATE_LIMIT_EXCEEDED",
                        message="Terlalu banyak operasi tulis. Coba lagi beberapa saat.",
                        module="limiter",
                    ),
                )
        if getattr(authorized_request.state, "is_master", False):
            return await call_next(authorized_request)

        rate_identifier = f"key:{client_key}" if client_key else extract_client_ip(authorized_request)
        module = authorized_request.url.path.split("/")[2] if authorized_request.url.path.startswith("/v1/") else "other"
        await record_request(module, getattr(authorized_request.state, "nim", None))
        if not await limiter.is_allowed(rate_identifier):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content=error_response(
                    code="RATE_LIMIT_EXCEEDED",
                    message="Rate limit exceeded (max 60 req/min)",
                    module="limiter",
                ),
            )
        return await call_next(authorized_request)

    # Auth must resolve request.state before rate-limit identity/bypass checks.
    return await api_key_auth_middleware(request, after_auth)

# CORS Middleware added after HTTP middlewares so it wraps outermost
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip() and o.strip() != "*"]
if not origins:
    origins = ["https://mira.muaraai.com", "https://ubsi-api.muaraai.com", "http://localhost:3000"]
# Credentialed cookies must never be combined with wildcard origin reflection.

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "If-None-Match", "X-API-Key", "X-Requested-With", "X-Studentv2-NIM", "X-Studentv2-Pass", "X-Elearning-NIM", "X-Elearning-Pass"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_err = errors[0] if errors else {}
    msg = first_err.get("msg", "Data request tidak valid")
    loc = ".".join(str(l) for l in first_err.get("loc", []) if l != "body")
    error_msg = f"{loc}: {msg}" if loc else msg
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=error_response(
            code="VALIDATION_ERROR",
            message=error_msg,
            module="validation",
        ),
    )

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(code="HTTP_ERROR", message=str(exc.detail))
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response(code="INTERNAL_SERVER_ERROR", message="Terjadi kesalahan internal pada server")
    )

@app.get("/v1/docs", status_code=status.HTTP_200_OK)
async def get_documentation(category: Optional[str] = None):
    """Kamus dokumentasi lengkap seluruh endpoint REST API dan MCP tools UBSI API."""
    data = get_api_docs(category)
    return success_response(data=data)

@app.get("/health", status_code=status.HTTP_200_OK)
async def health():
    redis_status = "down"
    try:
        client = await cache.get_client()
        pong = await client.ping()
        if pong:
            redis_status = "up"
    except Exception:
        redis_status = "down"
    return {"status": "ok", "redis": redis_status}


@app.get("/metrics", status_code=status.HTTP_200_OK)
async def metrics():
    """Ringkasan kesehatan scraper: ukuran pool sesi dan status Redis."""
    sv2_pool = getattr(studentv2_client, "_pool", None)
    sv2_sessions = len(sv2_pool) if sv2_pool is not None else 0
    el_pool = getattr(pooled_elearning_client, "_pool", None)
    el_sessions = len(el_pool) if el_pool is not None else 0

    redis_status = "down"
    try:
        client = await cache.get_client()
        pong = await client.ping()
        if pong:
            redis_status = "up"
    except Exception:
        redis_status = "down"
    return {
        "status": "ok",
        "redis": redis_status,
        "active_sessions": sv2_sessions + el_sessions,
        "studentv2_sessions": sv2_sessions,
        "elearning_sessions": el_sessions,
        "uptime_note": "sessions are per-NIM with 15 min idle TTL",
    }
