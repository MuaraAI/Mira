"""Regression: solver lama jangan mengirim tebakan saat CAPTCHA kampus berbentuk gambar."""
import httpx

from app.modules.elearning import ElearningClient


class _FakeHttpClient:
    is_closed = False

    def __init__(self, page_html: str):
        self.cookies = httpx.Cookies()
        self._page = page_html
        self.posted: list[dict] = []

    def get(self, url, **kwargs):
        return httpx.Response(200, text=self._page, request=httpx.Request("GET", url))

    def post(self, url, data=None, **kwargs):
        self.posted.append(dict(data or {}))
        return httpx.Response(
            200,
            text=(
                '<input name="password" type="password">'
                '<div class="invalid-feedback">Kode keamanan salah. Silakan periksa kembali '
                "karakter pada gambar.</div>"
            ),
            request=httpx.Request("POST", url),
        )


def test_image_captcha_page_never_submits_guessed_answer():
    # String base64 PNG sengaja memuat "3+3" seperti halaman kampus asli.
    # Solver matematika lama mengubahnya jadi 6 lalu POST captcha_answer=6.
    html = (
        '<input type="hidden" name="_token" value="tok-123">'
        '<input id="captcha_answer" name="captcha_answer" maxlength="3">'
        '<img src="data:image/png;base64,iVBOR3+3wAAAABJRU5ErkJggg==" alt="Kode Keamanan">'
    )
    client = ElearningClient()
    fake = _FakeHttpClient(html)
    client._client = fake

    ok = client.login("12345678", "password")

    assert ok is False
    assert client._login_failure == "captcha"
    assert fake.posted == []
