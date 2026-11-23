"""Identitas device: cookie mira_device dan label perangkat dari User-Agent."""
import pytest
from fastapi import Response
from starlette.requests import Request

from app.device_identity import (
    DEVICE_COOKIE,
    DEVICE_COOKIE_MAX_AGE,
    device_label,
    issue_device_cookie,
    new_device_id,
    read_device_id,
)


def _request_with_cookie(raw: str | None) -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if raw is not None:
        headers.append((b"cookie", raw.encode()))
    return Request({"type": "http", "headers": headers})


def test_new_device_id_is_64_hex_chars_without_colon():
    first = new_device_id()
    second = new_device_id()

    assert len(first) == 64
    assert all(char in "0123456789abcdef" for char in first)
    assert ":" not in first
    assert first != second


def test_read_device_id_returns_cookie_value():
    request = _request_with_cookie(f"{DEVICE_COOKIE}=abc123; ubsi_session=tok")

    assert read_device_id(request) == "abc123"


def test_read_device_id_returns_empty_string_when_cookie_missing():
    assert read_device_id(_request_with_cookie("ubsi_session=tok")) == ""
    assert read_device_id(_request_with_cookie(None)) == ""


def test_issue_device_cookie_sets_secure_flags_for_https():
    response = Response()

    issue_device_cookie(response, "a" * 64, is_https=True, domain="example.com")

    header = response.headers["set-cookie"].lower()
    assert header.startswith(f"{DEVICE_COOKIE}=".lower())
    assert "httponly" in header
    assert "secure" in header
    assert "samesite=none" in header
    assert f"max-age={DEVICE_COOKIE_MAX_AGE}" in header
    assert "domain=example.com" in header


def test_issue_device_cookie_sets_lax_flags_for_http():
    response = Response()

    issue_device_cookie(response, "b" * 64, is_https=False, domain=None)

    header = response.headers["set-cookie"].lower()
    assert header.startswith(f"{DEVICE_COOKIE}=".lower())
    assert "httponly" in header
    assert "secure" not in header
    assert "samesite=lax" in header
    assert f"max-age={DEVICE_COOKIE_MAX_AGE}" in header
    assert "domain=" not in header


@pytest.mark.parametrize(
    "user_agent,expected",
    [
        (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36",
            "Chrome · Linux",
        ),
        (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Chrome · Windows",
        ),
        (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
            "Edge · Windows",
        ),
        (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) "
            "Gecko/20100101 Firefox/121.0",
            "Firefox · Windows",
        ),
        (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            "Safari · macOS",
        ),
        (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
            "Mobile/15E148 Safari/604.1",
            "Safari · iOS",
        ),
        (
            "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            "Chrome · Android",
        ),
    ],
)
def test_device_label_maps_browser_and_platform(user_agent, expected):
    assert device_label(user_agent) == expected


def test_device_label_falls_back_to_browser_for_empty_user_agent():
    assert device_label("") == "Browser"
