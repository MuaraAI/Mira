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
    """Login menyelesaikan CAPTCHA kampus di server.

    SIAKAD masih memakai CAPTCHA gambar (OCR), MyBest sudah puzzle geser.
    Tanpa stub, tiap POST /v1/auth/login menyentuh Redis nyata dan server kampus.
    Tes yang butuh perilaku lain mem-patch ulang di badan tes; patch di badan tes
    menimpa hasil fixture ini.
    """
    from unittest.mock import AsyncMock

    monkeypatch.setattr(
        "app.captcha_autosolver.candidate_session",
        AsyncMock(return_value=({"cookies": {"stub": "1"}, "token": "stub"}, ["STUB"])),
    )
    monkeypatch.setattr(
        "app.elearning_captcha.fetch_captcha_token",
        AsyncMock(return_value=({"cookies": {"stub": "1"}, "token": "stub"}, "STUB-PUZZLE")),
    )


@pytest.fixture(autouse=True)
def siakad_enabled_for_legacy_tests(monkeypatch):
    """Produksi default `SIAKAD_ENABLED=False`; suite lama menguji SIAKAD aktif.

    Test mode-mati mem-monkeypatch settings ke False di badan test (menimpa ini).
    """
    monkeypatch.setattr(settings, "SIAKAD_ENABLED", True)
