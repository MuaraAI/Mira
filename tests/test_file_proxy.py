"""Proxy berkas publik Google: hanya host Google, PDF/gambar, tanpa berkas privat."""
import httpx
import pytest

from app.file_proxy import ProxyError, content_disposition, fetch_public_file, source_url
from app.link_check import parse_share_link

FID = "1MXHPc0R1xzrwm6yLosPUaAbCdEfGhIjK"
FILE = parse_share_link(f"https://drive.google.com/file/d/{FID}/view")
DOC = parse_share_link(f"https://docs.google.com/document/d/{FID}/edit")


def client_for(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_source_urls_are_built_from_validated_ids():
    assert source_url(FILE) == f"https://drive.usercontent.google.com/download?id={FID}&export=download&confirm=t"
    assert source_url(DOC) == f"https://docs.google.com/document/d/{FID}/export?format=pdf"
    assert source_url(parse_share_link(f"https://docs.google.com/presentation/d/{FID}/edit")).endswith("/export/pdf")
    assert source_url(parse_share_link(f"https://drive.google.com/drive/folders/{FID}")) is None
    assert source_url(parse_share_link(f"https://docs.google.com/document/d/e/{FID}/pub")) is None
    assert source_url(parse_share_link("https://github.com/a/b")) is None


@pytest.mark.asyncio
async def test_public_pdf_is_returned_with_filename():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"%PDF-1.4 x", headers={"content-type": "application/pdf", "content-disposition": "attachment; filename*=UTF-8''Tugas%20Kantin.pdf"})

    async with client_for(handler) as client:
        data, content_type, name = await fetch_public_file(FILE, client)
    assert data.startswith(b"%PDF") and content_type == "application/pdf" and name == "Tugas Kantin.pdf"


@pytest.mark.asyncio
async def test_docs_export_follows_redirect_to_googleusercontent():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "docs.google.com":
            return httpx.Response(307, headers={"location": "https://doc-0c-ao-docs.googleusercontent.com/docs/export/abc"})
        assert request.url.host.endswith(".googleusercontent.com")
        return httpx.Response(200, content=b"%PDF-1.7", headers={"content-type": "application/pdf"})

    async with client_for(handler) as client:
        data, _, name = await fetch_public_file(DOC, client)
    assert data == b"%PDF-1.7" and name == "dokumen.pdf"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "response,code",
    [
        (httpx.Response(302, headers={"location": "https://accounts.google.com/ServiceLogin"}), "NOT_PUBLIC"),
        (httpx.Response(200, html="<html>Sign in</html>"), "NOT_PUBLIC"),
        (httpx.Response(404), "NOT_FOUND"),
        (httpx.Response(403), "NOT_PUBLIC"),
        (httpx.Response(200, content=b"PK", headers={"content-type": "application/zip"}), "UNSUPPORTED_TYPE"),
        (httpx.Response(200, content=b"x", headers={"content-type": "application/pdf", "content-length": str(26 * 1024 * 1024)}), "TOO_LARGE"),
        (httpx.Response(302, headers={"location": "https://evil.example.com/x"}), "UNSUPPORTED_LINK"),
        (httpx.Response(500), "UPSTREAM_ERROR"),
    ],
)
async def test_unsafe_or_unsupported_responses_are_rejected(response, code):
    async with client_for(lambda request: response) as client:
        with pytest.raises(ProxyError) as err:
            await fetch_public_file(FILE, client)
    assert err.value.code == code


@pytest.mark.asyncio
async def test_body_over_limit_is_aborted_while_streaming(monkeypatch):
    monkeypatch.setattr("app.file_proxy.MAX_BYTES", 10)
    async with client_for(lambda r: httpx.Response(200, content=b"%PDF" + b"x" * 50, headers={"content-type": "application/pdf"})) as client:
        with pytest.raises(ProxyError) as err:
            await fetch_public_file(FILE, client)
    assert err.value.code == "TOO_LARGE"


def test_content_disposition_is_header_safe():
    value = content_disposition('Tugas "Kantin"\r\nX: y é.pdf')
    assert "\r" not in value and "\n" not in value and '"Kantin"' not in value
    assert "filename*=UTF-8''" in value
