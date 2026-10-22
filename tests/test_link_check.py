"""Pemeriksa link tugas: struktur link + status akses tanpa login (offline, MockTransport)."""
import httpx
import pytest

from app.link_check import check_link, check_links, parse_share_link

FID = "1MXHPc0R1xzrwm6yLosPUaAbCdEfGhIjK"


@pytest.mark.parametrize(
    "url",
    [
        f"https://drive.google.com/file/d/{FID}/view?usp=sharing",
        f"https://drive.google.com/file/d/{FID}/edit",
        f"https://drive.google.com/open?id={FID}",
        f"https://drive.google.com/uc?export=download&id={FID}",
        f"https://drive.google.com/u/0/file/d/{FID}/view",
    ],
)
def test_drive_file_variants_normalize_to_one_clean_link(url):
    info = parse_share_link(url)
    assert info["provider"] == "google_drive" and info["kind"] == "file" and info["id"] == FID
    assert info["normalized_url"] == f"https://drive.google.com/file/d/{FID}/view"
    assert info["preview_url"] == f"https://drive.google.com/file/d/{FID}/preview"


def test_drive_folder_docs_and_github():
    folder = parse_share_link(f"https://drive.google.com/drive/folders/{FID}?usp=sharing")
    assert folder["kind"] == "folder" and "embeddedfolderview" in folder["preview_url"]

    doc = parse_share_link(f"https://docs.google.com/document/d/{FID}/edit?tab=t.0")
    assert doc["provider"] == "google_docs" and doc["kind"] == "docs"
    assert doc["preview_url"] == f"https://docs.google.com/document/d/{FID}/preview"

    sheet = parse_share_link(f"https://docs.google.com/spreadsheets/d/{FID}/edit#gid=0")
    assert sheet["kind"] == "sheets"

    repo = parse_share_link("https://github.com/MuaraAI/UBSI-API/tree/main/app")
    assert repo["kind"] == "repo" and repo["id"] == "MuaraAI/UBSI-API"
    assert repo["normalized_url"] == "https://github.com/MuaraAI/UBSI-API"
    assert repo["preview_url"] is None  # GitHub melarang di-embed


def test_other_hosts_are_parsed_but_never_probed():
    info = parse_share_link("https://www.dropbox.com/s/abc/tugas.pdf")
    assert info["label"] == "Tautan Dropbox" and info["probe_url"] is None
    assert parse_share_link("javascript:alert(1)") is None
    assert parse_share_link("ftp://example.com/file") is None
    assert parse_share_link("https://user:pw@drive.google.com/file/d/x") is None
    assert parse_share_link("tugas saya") is None


def client_for(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), headers={"User-Agent": "t"})


def html(title: str) -> httpx.Response:
    return httpx.Response(200, html=f"<html><head><title>{title}</title></head><body>Sign in</body></html>")


@pytest.mark.asyncio
async def test_public_file_reports_title_and_allows_preview():
    async with client_for(lambda r: html("Laporan Tugas 5.pdf - Google Drive")) as client:
        result = await check_link(f"https://drive.google.com/file/d/{FID}/view", client)
    assert result["access"] == "public" and result["title"] == "Laporan Tugas 5.pdf"
    assert result["can_preview"] is True


@pytest.mark.asyncio
async def test_private_file_redirect_to_login_is_flagged():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "drive.google.com"
        return httpx.Response(302, headers={"location": "https://accounts.google.com/ServiceLogin?continue=x"})

    async with client_for(handler) as client:
        result = await check_link(f"https://drive.google.com/file/d/{FID}/view", client)
    assert result["access"] == "private" and result["can_preview"] is False
    assert "privat" in result["message"]


@pytest.mark.asyncio
async def test_signin_page_title_counts_as_private_and_missing_is_404():
    async with client_for(lambda r: html("Sign in - Google Accounts")) as client:
        assert (await check_link(f"https://docs.google.com/document/d/{FID}/edit", client))["access"] == "private"
    async with client_for(lambda r: httpx.Response(404)) as client:
        assert (await check_link(f"https://drive.google.com/file/d/{FID}/view", client))["access"] == "missing"


@pytest.mark.asyncio
async def test_redirect_to_foreign_host_is_not_followed():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.host)
        return httpx.Response(302, headers={"location": "http://169.254.169.254/latest/meta-data"})

    async with client_for(handler) as client:
        result = await check_link(f"https://drive.google.com/file/d/{FID}/view", client)
    assert result["access"] == "unknown"
    assert calls == ["drive.google.com"]  # metadata server tidak pernah disentuh


@pytest.mark.asyncio
async def test_unsupported_host_is_never_fetched():
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("tidak boleh ada request keluar")

    async with client_for(handler) as client:
        result = await check_link("http://127.0.0.1:8300/admin", client)
    assert result["valid"] and result["access"] == "unknown"


@pytest.mark.asyncio
async def test_github_repo_public_and_missing():
    async with client_for(lambda r: httpx.Response(200, html="<title>MuaraAI/UBSI-API</title>")) as client:
        assert (await check_link("https://github.com/MuaraAI/UBSI-API", client))["access"] == "public"
    async with client_for(lambda r: httpx.Response(404)) as client:
        assert (await check_link("https://github.com/MuaraAI/rahasia", client))["access"] == "missing"


@pytest.mark.asyncio
async def test_invalid_link_and_cache_roundtrip():
    async with client_for(lambda r: html("x - Google Drive")) as client:
        assert (await check_link("bukan link", client))["access"] == "invalid"

        store: dict[str, str] = {}

        class FakeRedis:
            async def get(self, key):
                return store.get(key)

            async def set(self, key, value, ex=None):
                store[key] = value

        redis = FakeRedis()
        url = f"https://drive.google.com/file/d/{FID}/view"
        first = await check_link(url, client, redis)
        assert first["access"] == "public" and store

    def boom(request):
        raise AssertionError("harus dari cache")

    async with client_for(boom) as client:
        assert (await check_link(url, client, redis))["access"] == "public"
        refreshed = None
    assert refreshed is None


@pytest.mark.asyncio
async def test_check_links_keeps_order(monkeypatch):
    urls = ["bukan link", f"https://drive.google.com/file/d/{FID}/view"]
    monkeypatch.setattr("app.link_check.probe_full", lambda client, url: _async(("private", None, "x", None)))
    results = await check_links(urls)
    assert [r["access"] for r in results] == ["invalid", "private"]


async def _async(value):
    return value


@pytest.mark.parametrize(
    "raw",
    [
        f"drive.google.com/drive/folders/{FID}",
        f"  https://drive.google.com/drive/u/0/folders/{FID}?usp=sharing  ",
        f"https://drive.google.com/drive/mobile/folders/{FID}",
        f"https://drive.google.com/folderview?id={FID}",
        f"Ini link tugas saya: https://drive.google.com/drive/folders/{FID}?usp=drive_link, mohon dicek",
        f"<https://drive.google.com/drive/folders/{FID}>",
    ],
)
def test_folder_link_variants_and_messy_input(raw):
    info = parse_share_link(raw)
    assert info["kind"] == "folder" and info["id"] == FID
    assert info["normalized_url"] == f"https://drive.google.com/drive/folders/{FID}"
    assert info["preview_url"] == f"https://drive.google.com/embeddedfolderview?id={FID}#list"


def test_file_variants_with_account_index_and_usercontent_host():
    for raw in (
        f"https://drive.google.com/file/u/1/d/{FID}/view",
        f"https://drive.usercontent.google.com/download?id={FID}&export=download",
    ):
        info = parse_share_link(raw)
        assert info["kind"] == "file" and info["id"] == FID


def test_open_id_is_flagged_ambiguous_but_other_forms_are_not():
    assert parse_share_link(f"https://drive.google.com/open?id={FID}")["ambiguous"] is True
    assert parse_share_link(f"https://drive.google.com/file/d/{FID}/view")["ambiguous"] is False


def test_published_google_docs_use_embed_urls_and_youtube_has_embed():
    doc = parse_share_link(f"https://docs.google.com/document/d/e/{FID}/pub")
    assert doc["preview_url"] == f"https://docs.google.com/document/d/e/{FID}/pub?embedded=true"
    sheet = parse_share_link(f"https://docs.google.com/spreadsheets/d/e/{FID}/pubhtml")
    assert "widget=true" in sheet["preview_url"]
    yt = parse_share_link("https://youtu.be/dQw4w9WgXcQ?t=10")
    assert yt["provider"] == "youtube" and yt["preview_url"] == "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    assert yt["probe_url"] is None


@pytest.mark.asyncio
async def test_open_id_that_redirects_to_a_folder_is_resolved_as_folder():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/open":
            return httpx.Response(302, headers={"location": f"https://drive.google.com/drive/folders/{FID}"})
        assert request.url.path.startswith("/drive/folders/")
        return html("Tugas Akhir - Google Drive")

    async with client_for(handler) as client:
        result = await check_link(f"https://drive.google.com/open?id={FID}&usp=sharing", client)
    assert result["kind"] == "folder" and result["label"] == "Folder Google Drive"
    assert result["access"] == "public" and result["title"] == "Tugas Akhir"
    assert result["normalized_url"] == f"https://drive.google.com/drive/folders/{FID}"
    assert result["preview_url"].startswith("https://drive.google.com/embeddedfolderview")
    assert result["can_preview"] is True


@pytest.mark.asyncio
async def test_open_id_private_stays_file_and_not_previewable():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "https://accounts.google.com/ServiceLogin?continue=x"})

    async with client_for(handler) as client:
        result = await check_link(f"https://drive.google.com/open?id={FID}", client)
    assert result["access"] == "private" and result["can_preview"] is False


@pytest.mark.asyncio
async def test_youtube_link_is_previewable_without_probing():
    def boom(request):
        raise AssertionError("YouTube tidak boleh di-fetch")

    async with client_for(boom) as client:
        result = await check_link("https://www.youtube.com/watch?v=dQw4w9WgXcQ", client)
    assert result["can_preview"] is True and result["access"] == "unknown"
