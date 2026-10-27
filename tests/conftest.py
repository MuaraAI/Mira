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
        headers["X-Studentv2-NIM"] = "15260767"
        headers["X-Studentv2-Pass"] = "secret"
    if not skip and "X-Elearning-NIM" not in headers and "x-elearning-nim" not in headers:
        headers["X-Elearning-NIM"] = "15260767"
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
    # Default produksi tanpa MOCK_MODE: pastikan router mock tidak ter-mount by default.
    monkeypatch.setattr(settings, "MOCK_MODE", False)
