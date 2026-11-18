import pytest
from httpx import AsyncClient
from app.config import settings

_original_init = AsyncClient.__init__

def _patched_init(self, *args, **kwargs):
    headers = kwargs.get("headers")
    if headers is None:
        headers = {}
    else:
        headers = dict(headers)
    skip = headers.pop("_skip_auto_auth", None)
    if not skip and "X-API-Key" not in headers:
        headers["X-API-Key"] = "test-secret-key-12345"
    if not skip and "X-Studentv2-NIM" not in headers and "x-studentv2-nim" not in headers:
        headers["X-Studentv2-NIM"] = "12345678"
        headers["X-Studentv2-Pass"] = "secret"
    if not skip and "X-Elearning-NIM" not in headers and "x-elearning-nim" not in headers:
        headers["X-Elearning-NIM"] = "12345678"
        headers["X-Elearning-Pass"] = "secret"
    kwargs["headers"] = headers
    _original_init(self, *args, **kwargs)

@pytest.fixture(autouse=True)
def auto_auth_client(monkeypatch):
    monkeypatch.setattr(AsyncClient, "__init__", _patched_init)
    monkeypatch.setattr(settings, "API_KEY", "test-secret-key-12345")
    # Test suite wajib 100% offline (Iron Rule #2): paksa SQLite in-memory,
    # jangan biarkan SUPABASE_DB_URL lokal menyentuh remote Supabase di pytest.
    monkeypatch.setattr(settings, "SUPABASE_DB_URL", "")


@pytest.fixture(autouse=True)
def reset_upstream_login_blocks():
    """Cooldown login upstream bersifat global; reset tiap test agar tidak bocor."""
    from app.upstream_session import reset_blocks

    reset_blocks()
    yield
    reset_blocks()

@pytest.fixture(autouse=True)
def stub_campus_captcha(monkeypatch):
    """Login kini selalu memverifikasi CAPTCHA Mira lalu auto-solve CAPTCHA kampus.

    Tanpa stub, tiap POST /v1/auth/login menyentuh Redis nyata dan server kampus:
    body tanpa mira_captcha memicu create_challenge (Redis) di branch penolakan,
    dan auto-solve memanggil endpoint kampus. Tes yang butuh perilaku asli
    (MIRA_CAPTCHA_INVALID, fallback, tantangan nyata) mem-patch ulang di badan tes;
    patch di badan tes menimpa hasil fixture ini.
    """
    from unittest.mock import AsyncMock

    monkeypatch.setattr("app.mira_captcha.verify_challenge", AsyncMock(return_value=True))
    monkeypatch.setattr(
        "app.mira_captcha.create_challenge",
        AsyncMock(return_value={"id": "stub-mira", "image": "data:image/svg+xml;base64,STVBUg==", "expires_in": 600}),
    )
    monkeypatch.setattr(
        "app.captcha_autosolver.solve_campus_captcha",
        AsyncMock(return_value=({"cookies": {"stub": "1"}, "token": "stub"}, "STUB")),
    )


@pytest.fixture(autouse=True)
def siakad_enabled_for_legacy_tests(monkeypatch):
    """Produksi default `SIAKAD_ENABLED=False`; suite lama menguji SIAKAD aktif.

    Test mode-mati mem-monkeypatch settings ke False di badan test (menimpa ini).
    """
    monkeypatch.setattr(settings, "SIAKAD_ENABLED", True)
