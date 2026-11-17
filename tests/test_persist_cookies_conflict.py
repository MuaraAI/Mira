"""Cookie sesi kampus dengan nama sama di dua path (mis. XSRF-TOKEN) tidak boleh menggagalkan persist."""
import httpx

from app.upstream_session import campus_cookie_dict


def _jar_with_duplicate_xsrf() -> httpx.Cookies:
    cookies = httpx.Cookies()
    cookies.set("XSRF-TOKEN", "old", domain="students.bsi.ac.id", path="/")
    cookies.set("XSRF-TOKEN", "new", domain="students.bsi.ac.id", path="/login")
    cookies.set("laravel_session", "sess", domain="students.bsi.ac.id", path="/")
    return cookies


def test_campus_cookie_dict_handles_duplicate_names_without_raising():
    # Arrange
    cookies = _jar_with_duplicate_xsrf()

    # Act
    result = campus_cookie_dict(cookies)

    # Assert
    assert result["laravel_session"] == "sess"
    assert result["XSRF-TOKEN"] in {"old", "new"}
    assert set(result) == {"XSRF-TOKEN", "laravel_session"}
