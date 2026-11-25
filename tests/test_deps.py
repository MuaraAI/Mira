"""Kontrak langsung dependency kredensial: sesi kanonis, header override, 401."""
import pytest
from starlette.requests import Request
from fastapi import HTTPException
from app.account_links import init_account_links_db, set_link
from app.config import Settings, settings
from app.deps import require_elearning_creds, require_studentv2_creds


@pytest.fixture
async def tmp_accounts_db(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "accounts.sqlite3"))
    await init_account_links_db()


def _request(headers=None) -> Request:
    return Request({"type": "http", "headers": headers or [], "state": {}})


async def test_tier1_session_credentials(tmp_accounts_db):
    """Sesi aktif membaca password SIAKAD dari store kanonis, bukan salinan sesi."""
    await set_link("12345678", "siakad", kind="password", secret="kanonis-pass")

    req = _request()
    req.state.nim = "12345678"
    req.state.elearning_pass = "session_el_pass"
    req.state.auth_type = "session"

    el_nim, el_pwd = require_elearning_creds(req)
    assert el_nim == "12345678"
    assert el_pwd == "session_el_pass"

    sv_nim, sv_pwd = await require_studentv2_creds(req)
    assert sv_nim == "12345678"
    assert sv_pwd == "kanonis-pass"

async def test_tier2_header_override():
    scope_headers = [
        (b"x-elearning-nim", b"12345679"),
        (b"x-elearning-pass", b"header_el_pass"),
        (b"x-studentv2-nim", b"12345699"),
        (b"x-studentv2-pass", b"header_sv_pass"),
    ]
    req = _request(scope_headers)

    el_nim, el_pwd = require_elearning_creds(req)
    assert el_nim == "12345679"
    assert el_pwd == "header_el_pass"

    sv_nim, sv_pwd = await require_studentv2_creds(req)
    assert sv_nim == "12345699"
    assert sv_pwd == "header_sv_pass"

async def test_missing_credentials_raises_401():
    req = _request()
    empty_cfg = Settings(_env_file=None)

    with pytest.raises(HTTPException) as exc_el:
        require_elearning_creds(req, cfg=empty_cfg)
    assert exc_el.value.status_code == 401
    assert exc_el.value.detail["error"]["code"] == "UNAUTHORIZED"

    with pytest.raises(HTTPException) as exc_sv:
        await require_studentv2_creds(req, cfg=empty_cfg)
    assert exc_sv.value.status_code == 401
    assert exc_sv.value.detail["error"]["code"] == "UNAUTHORIZED"

async def test_backward_compatible_signature_with_settings_as_first_arg():
    empty_cfg = Settings(_env_file=None)
    with pytest.raises(HTTPException) as exc_el:
        require_elearning_creds(empty_cfg)
    assert exc_el.value.status_code == 401

    with pytest.raises(HTTPException) as exc_sv:
        await require_studentv2_creds(empty_cfg)
    assert exc_sv.value.status_code == 401
