"""Test Mira Komunitas (/v1/social). 100% offline: SQLite temp + FakeRedis + event bus tertangkap."""
import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.social import events as social_events
from tests.test_auth_session_channels import FakeRedis

NIMS = {"ayu": "19230001", "budi": "19230002", "citra": "19230003"}


@pytest.fixture(autouse=True)
def social_env(monkeypatch, tmp_path):
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(tmp_path / "social.db"))
    from app.social.db import init_social_db

    init_social_db()
    fake = FakeRedis()
    monkeypatch.setattr("app.session_store.session_store._client", fake)
    published: list = []

    async def capture(evts):
        published.extend(e for e in evts if e.recipients)

    monkeypatch.setattr(social_events, "publish", capture)
    yield published


async def _token(nim: str) -> str:
    from app.session_store import session_store

    return await session_store.create(nim, "sv2-pass", "el-pass")


def _client(token: str | None = None) -> AsyncClient:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers=headers)


_open_clients: list[AsyncClient] = []


@pytest.fixture(autouse=True)
async def close_clients():
    yield
    while _open_clients:
        await _open_clients.pop().aclose()


async def _user(name: str) -> AsyncClient:
    client = _client(await _token(NIMS[name]))
    _open_clients.append(client)
    res = await client.patch("/v1/social/me", json={"username": name, "display_name": name.title()})
    assert res.status_code == 200, res.text
    return client


@pytest.mark.asyncio
async def test_master_key_cannot_use_social():
    async with _client() as client:
        res = await client.get("/v1/social/inbox")
    assert res.status_code == 403
    assert res.json()["error"]["module"] == "social"


@pytest.mark.asyncio
async def test_onboarding_and_unique_username():
    async with _client(await _token(NIMS["ayu"])) as ayu:
        me = (await ayu.get("/v1/social/me")).json()["data"]
        assert me["needs_onboarding"] is True

        bad = await ayu.patch("/v1/social/me", json={"username": "A!", "display_name": "Ayu"})
        assert bad.status_code in (400, 422)

        ok = await ayu.patch("/v1/social/me", json={"username": "@Ayu_Dev", "display_name": "  Ayu   P  "})
        profile = ok.json()["data"]["profile"]
        assert profile["username"] == "ayu_dev"
        assert profile["display_name"] == "Ayu P"

    async with _client(await _token(NIMS["budi"])) as budi:
        taken = await budi.patch("/v1/social/me", json={"username": "AYU_DEV", "display_name": "Budi"})
        assert taken.status_code == 409
        assert taken.json()["error"]["code"] == "USERNAME_TAKEN"


@pytest.mark.asyncio
async def test_actions_require_profile():
    async with _client(await _token(NIMS["ayu"])) as ayu:
        res = await ayu.post("/v1/social/spaces", json={"name": "Kelas TI"})
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "PROFILE_REQUIRED"


@pytest.mark.asyncio
async def test_space_lifecycle_and_permissions(social_env):
    ayu, budi, citra = await _user("ayu"), await _user("budi"), await _user("citra")
    created = await ayu.post("/v1/social/spaces", json={"name": "Kelas 15.4A", "description": "Angkatan 2023"})
    assert created.status_code == 201
    space = created.json()["data"]["space"]
    assert space["my_role"] == "owner"
    assert [c["name"] for c in space["channels"]] == ["umum"]

    # Tanpa undangan, ruang privat tidak bisa diintip.
    assert (await budi.get(f"/v1/social/spaces/{space['id']}")).status_code == 404
    assert (await budi.post(f"/v1/social/spaces/{space['id']}/join")).status_code == 404

    joined = await budi.post("/v1/social/spaces/join", json={"invite_code": f"https://mira/join/{space['invite_code']}"})
    assert joined.status_code == 200
    assert joined.json()["data"]["space"]["my_role"] == "member"

    # Member biasa tidak bisa bikin channel; admin bisa.
    assert (await budi.post(f"/v1/social/spaces/{space['id']}/channels", json={"name": "tugas"})).status_code == 403
    promote = await ayu.patch(f"/v1/social/spaces/{space['id']}/members/budi", json={"role": "admin"})
    assert promote.status_code == 200
    channel = await budi.post(f"/v1/social/spaces/{space['id']}/channels", json={"name": "Tugas Besar"})
    assert channel.status_code == 201
    assert channel.json()["data"]["channel"]["name"] == "tugas-besar"
    dup = await budi.post(f"/v1/social/spaces/{space['id']}/channels", json={"name": "tugas besar"})
    assert dup.status_code == 409

    # Reset undangan membatalkan kode lama.
    old_code = space["invite_code"]
    await ayu.post(f"/v1/social/spaces/{space['id']}/invite/reset")
    assert (await citra.post("/v1/social/spaces/join", json={"invite_code": old_code})).status_code == 404

    # Admin tidak bisa kick owner; owner tidak bisa keluar.
    assert (await budi.delete(f"/v1/social/spaces/{space['id']}/members/ayu")).status_code == 403
    assert (await ayu.post(f"/v1/social/spaces/{space['id']}/leave")).status_code == 400

    members = (await ayu.get(f"/v1/social/spaces/{space['id']}/members")).json()["data"]["members"]
    assert [m["username"] for m in members] == ["ayu", "budi"]
    assert "nim" not in json.dumps(members)

    assert (await budi.post(f"/v1/social/spaces/{space['id']}/leave")).status_code == 200
    assert (await ayu.delete(f"/v1/social/spaces/{space['id']}")).status_code == 200
    assert (await ayu.get("/v1/social/inbox")).json()["data"]["spaces"] == []


@pytest.mark.asyncio
async def test_public_discovery_and_join():
    ayu, budi = await _user("ayu"), await _user("budi")
    space = (await ayu.post("/v1/social/spaces", json={"name": "Klub Robotik", "is_public": True})).json()["data"]["space"]
    await ayu.post("/v1/social/spaces", json={"name": "Rahasia"})
    found = (await budi.get("/v1/social/spaces/discover", params={"q": "robot"})).json()["data"]["spaces"]
    assert [s["name"] for s in found] == ["Klub Robotik"]
    assert "invite_code" not in found[0]
    assert (await budi.post(f"/v1/social/spaces/{space['id']}/join")).status_code == 200


@pytest.mark.asyncio
async def test_channel_messages_mentions_unread_and_events(social_env):
    ayu, budi, citra = await _user("ayu"), await _user("budi"), await _user("citra")
    space = (await ayu.post("/v1/social/spaces", json={"name": "Kelas"})).json()["data"]["space"]
    channel_id = space["channels"][0]["id"]
    await budi.post("/v1/social/spaces/join", json={"invite_code": space["invite_code"]})
    await citra.post("/v1/social/spaces/join", json={"invite_code": space["invite_code"]})
    social_env.clear()

    sent = await ayu.post(
        f"/v1/social/conversations/{channel_id}/messages",
        json={"body": "Halo @budi, cek tugas ya\n\n\n\nmakasih"},
    )
    assert sent.status_code == 201
    msg = sent.json()["data"]["message"]
    assert msg["body"] == "Halo @budi, cek tugas ya\n\nmakasih"
    assert msg["author"] == {"username": "ayu", "display_name": "Ayu", "avatar": None}

    created = [e for e in social_env if e.type == "message.created"]
    flagged = {nim for e in created if e.payload["mentioned"] for nim in e.recipients}
    everyone = {nim for e in created for nim in e.recipients}
    assert flagged == {NIMS["budi"]}
    assert everyone == set(NIMS.values())

    inbox = (await budi.get("/v1/social/inbox")).json()["data"]
    ch = inbox["spaces"][0]["channels"][0]
    assert (ch["unread"], ch["mentions"]) == (1, 1)
    assert (await citra.get("/v1/social/inbox")).json()["data"]["spaces"][0]["mentions"] == 0
    assert (await ayu.get("/v1/social/inbox")).json()["data"]["spaces"][0]["unread"] == 0

    reply = await budi.post(
        f"/v1/social/conversations/{channel_id}/messages", json={"body": "Siap", "reply_to_id": msg["id"]}
    )
    assert reply.json()["data"]["message"]["reply_to"]["author"]["username"] == "ayu"

    await budi.post(f"/v1/social/conversations/{channel_id}/read", json={"message_id": 10_000})
    ch = (await budi.get("/v1/social/inbox")).json()["data"]["spaces"][0]["channels"][0]
    assert (ch["unread"], ch["mentions"]) == (0, 0)
    assert ch["last_read_id"] == reply.json()["data"]["message"]["id"]


@pytest.mark.asyncio
async def test_pagination_cursor():
    ayu = await _user("ayu")
    space = (await ayu.post("/v1/social/spaces", json={"name": "Solo"})).json()["data"]["space"]
    cid = space["channels"][0]["id"]
    for i in range(5):
        await ayu.post(f"/v1/social/conversations/{cid}/messages", json={"body": f"pesan {i}"})
    page = (await ayu.get(f"/v1/social/conversations/{cid}/messages", params={"limit": 3})).json()["data"]
    assert [m["body"] for m in page["messages"]] == ["pesan 2", "pesan 3", "pesan 4"]
    assert page["has_more"] is True
    older = (await ayu.get(
        f"/v1/social/conversations/{cid}/messages", params={"before": page["messages"][0]["id"], "limit": 3}
    )).json()["data"]
    assert [m["body"] for m in older["messages"]] == ["pesan 0", "pesan 1"]
    assert older["has_more"] is False
    newer = (await ayu.get(
        f"/v1/social/conversations/{cid}/messages", params={"after": page["messages"][1]["id"]}
    )).json()["data"]
    assert [m["body"] for m in newer["messages"]] == ["pesan 4"]


@pytest.mark.asyncio
async def test_edit_delete_reaction_and_pin_rules():
    ayu, budi = await _user("ayu"), await _user("budi")
    space = (await ayu.post("/v1/social/spaces", json={"name": "Kelas"})).json()["data"]["space"]
    cid = space["channels"][0]["id"]
    await budi.post("/v1/social/spaces/join", json={"invite_code": space["invite_code"]})
    mid = (await budi.post(f"/v1/social/conversations/{cid}/messages", json={"body": "typo"})).json()["data"]["message"]["id"]

    assert (await ayu.patch(f"/v1/social/messages/{mid}", json={"body": "hack"})).status_code == 403
    edited = (await budi.patch(f"/v1/social/messages/{mid}", json={"body": "fixed"})).json()["data"]["message"]
    assert edited["body"] == "fixed" and edited["edited_at"]

    assert (await budi.post(f"/v1/social/messages/{mid}/reactions/unicorn")).status_code == 400
    react = (await ayu.post(f"/v1/social/messages/{mid}/reactions/fire")).json()["data"]["message"]
    assert react["reactions"] == [{"key": "fire", "count": 1, "users": ["ayu"]}]
    react = (await ayu.post(f"/v1/social/messages/{mid}/reactions/fire")).json()["data"]["message"]
    assert react["reactions"] == []

    # Pin di channel khusus admin.
    assert (await budi.post(f"/v1/social/messages/{mid}/pin")).status_code == 403
    assert (await ayu.post(f"/v1/social/messages/{mid}/pin")).json()["data"]["message"]["pinned"] is True
    pins = (await budi.get(f"/v1/social/conversations/{cid}/pins")).json()["data"]["messages"]
    assert [p["id"] for p in pins] == [mid]

    found = (await budi.get(f"/v1/social/conversations/{cid}/search", params={"q": "fix"})).json()["data"]["messages"]
    assert [m["id"] for m in found] == [mid]

    # Owner boleh moderasi (hapus) pesan anggota; isi pesan dikosongkan.
    deleted = (await ayu.delete(f"/v1/social/messages/{mid}")).json()["data"]["message"]
    assert deleted["deleted"] is True and deleted["body"] == "" and deleted["pinned"] is False
    assert (await budi.get(f"/v1/social/conversations/{cid}/pins")).json()["data"]["messages"] == []


@pytest.mark.asyncio
async def test_direct_messages_read_receipts_and_privacy(social_env):
    ayu, budi, citra = await _user("ayu"), await _user("budi"), await _user("citra")
    found = (await ayu.get("/v1/social/users", params={"q": "bu"})).json()["data"]["users"]
    assert [u["username"] for u in found] == ["budi"]

    dm = (await ayu.post("/v1/social/dms", json={"username": "budi"})).json()["data"]["conversation"]
    again = (await budi.post("/v1/social/dms", json={"username": "ayu"})).json()["data"]["conversation"]
    assert dm["id"] == again["id"]

    mid = (await ayu.post(f"/v1/social/conversations/{dm['id']}/messages", json={"body": "hai"})).json()["data"]["message"]["id"]
    assert (await citra.get(f"/v1/social/conversations/{dm['id']}/messages")).status_code == 404

    inbox = (await budi.get("/v1/social/inbox")).json()["data"]
    assert inbox["dms"][0]["unread"] == 1
    assert inbox["dms"][0]["peer"]["username"] == "ayu"
    assert inbox["dms"][0]["last_message"]["preview"] == "hai"

    social_env.clear()
    await budi.post(f"/v1/social/conversations/{dm['id']}/read", json={"message_id": mid})
    receipt = next(e for e in social_env if e.type == "conversation.read")
    assert set(receipt.recipients) == {NIMS["ayu"], NIMS["budi"]}
    page = (await ayu.get(f"/v1/social/conversations/{dm['id']}/messages")).json()["data"]
    assert page["peer_last_read_id"] == mid

    # DM: kedua pihak boleh pin.
    assert (await budi.post(f"/v1/social/messages/{mid}/pin")).status_code == 200

    assert NIMS["budi"] not in json.dumps(inbox)


@pytest.mark.asyncio
async def test_saved_messages_self_dm():
    ayu = await _user("ayu")
    saved = (await ayu.post("/v1/social/dms", json={"username": "ayu"})).json()["data"]["conversation"]
    assert saved["is_saved"] is True
    await ayu.post(f"/v1/social/conversations/{saved['id']}/messages", json={"body": "catatan"})
    dms = (await ayu.get("/v1/social/inbox")).json()["data"]["dms"]
    assert dms[0]["is_saved"] is True and dms[0]["unread"] == 0


@pytest.mark.asyncio
async def test_kicked_member_loses_access():
    ayu, budi = await _user("ayu"), await _user("budi")
    space = (await ayu.post("/v1/social/spaces", json={"name": "Kelas"})).json()["data"]["space"]
    cid = space["channels"][0]["id"]
    await budi.post("/v1/social/spaces/join", json={"invite_code": space["invite_code"]})
    assert (await ayu.delete(f"/v1/social/spaces/{space['id']}/members/budi")).status_code == 200
    assert (await budi.get(f"/v1/social/conversations/{cid}/messages")).status_code == 404
    assert (await budi.post(f"/v1/social/conversations/{cid}/messages", json={"body": "x"})).status_code == 404


@pytest.mark.asyncio
async def test_academic_card_and_radar():
    ayu = await _user("ayu")
    budi = await _user("budi")

    # Update profil Ayu dengan cabang dan preset avatar Mura
    r = await ayu.patch(
        "/v1/social/me",
        json={
            "username": "ayu",
            "display_name": "Ayu Lestari",
            "bio": "Mahasiswa Pontianak",
            "campus_branch": "UBSI Pontianak",
            "major": "Informatika",
            "avatar_preset": "mura-ngoding",
        },
    )
    assert r.status_code == 200
    p = r.json()["data"]["profile"]
    assert p["campus_branch"] == "UBSI Pontianak"
    assert p["major"] == "Informatika"
    assert p["avatar_preset"] == "mura-ngoding"

    # Budi mencari teman di cabang Pontianak lewat Radar
    radar = (await budi.get("/v1/social/radar?branch=UBSI+Pontianak")).json()["data"]["users"]
    assert any(u["username"] == "ayu" for u in radar)

    # Budi buka DM ke Ayu
    conv = (await budi.post("/v1/social/dms", json={"username": "ayu"})).json()["data"]["conversation"]

    # Budi kirim DM ke Ayu terenkripsi E2EE (ciphertext acak + nonce)
    res_e2ee = await budi.post(
        f"/v1/social/conversations/{conv['id']}/messages",
        json={
            "body": "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",  # ciphertext hasil enkripsi di browser
            "is_encrypted": True,
            "encryption_nonce": "a1b2c3d4e5f67890",
        },
    )
    assert res_e2ee.status_code == 201
    msg_e2ee = res_e2ee.json()["data"]["message"]
    assert msg_e2ee["is_encrypted"] is True
    assert msg_e2ee["encryption_nonce"] == "a1b2c3d4e5f67890"
    assert msg_e2ee["body"] == "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c"


@pytest.mark.asyncio
async def test_stream_falls_back_when_redis_unavailable(monkeypatch):
    async def boom(nim):
        raise ConnectionError("redis down")

    monkeypatch.setattr(social_events.Subscription, "open", boom)
    ayu = await _user("ayu")
    res = await ayu.get("/v1/social/stream")
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "STREAM_UNAVAILABLE"


# ------------------------------------------------------------------ v2: media, invite preview, delete, edits, presence

_WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 24


@pytest.mark.asyncio
async def test_media_upload_validation_and_public_serving():
    ayu = await _user("ayu")
    bad = await ayu.post("/v1/social/media", files={"file": ("x.webp", b"<svg onload=alert(1)>", "image/webp")}, data={"kind": "avatar"})
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "MEDIA_INVALID"
    big = await ayu.post("/v1/social/media", files={"file": ("x.webp", _WEBP + b"\x00" * 400_000, "image/webp")}, data={"kind": "avatar"})
    assert big.status_code == 400

    up = await ayu.post("/v1/social/media", files={"file": ("a.webp", _WEBP, "image/webp")}, data={"kind": "avatar"})
    assert up.status_code == 201
    media_id = up.json()["data"]["id"]
    assert media_id.endswith(".webp")

    # Disajikan tanpa auth (untuk <img>), dengan cache immutable.
    async with _client() as anon:
        served = await anon.get(f"/v1/social/media/{media_id}", headers={"X-API-Key": ""})
    assert served.status_code == 200
    assert served.headers["content-type"] == "image/webp"
    assert "immutable" in served.headers["cache-control"]
    async with _client() as anon:
        assert (await anon.get("/v1/social/media/..%2F..%2Fetc%2Fpasswd")).status_code == 404

    profile = (await ayu.patch("/v1/social/me/media", json={"avatar": media_id})).json()["data"]["profile"]
    assert profile["avatar"] == media_id and profile["banner"] is None
    # Hanya field yang dikirim yang berubah; null menghapus.
    profile = (await ayu.patch("/v1/social/me/media", json={"banner": media_id})).json()["data"]["profile"]
    assert profile["avatar"] == media_id and profile["banner"] == media_id
    profile = (await ayu.patch("/v1/social/me/media", json={"avatar": None})).json()["data"]["profile"]
    assert profile["avatar"] is None and profile["banner"] == media_id
    missing = await ayu.patch("/v1/social/me/media", json={"avatar": "0" * 32 + ".webp"})
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_space_media_and_invite_preview():
    ayu, budi = await _user("ayu"), await _user("budi")
    space = (await ayu.post("/v1/social/spaces", json={"name": "Kelas", "description": "Info kelas"})).json()["data"]["space"]
    media_id = (await ayu.post("/v1/social/media", files={"file": ("b.webp", _WEBP, "image/webp")}, data={"kind": "banner"})).json()["data"]["id"]
    assert (await budi.patch(f"/v1/social/spaces/{space['id']}/media", json={"banner": media_id})).status_code == 404
    updated = (await ayu.patch(f"/v1/social/spaces/{space['id']}/media", json={"banner": media_id})).json()["data"]["space"]
    assert updated["banner"] == media_id

    preview = (await budi.get(f"/v1/social/invites/{space['invite_code']}")).json()["data"]["space"]
    assert preview["name"] == "Kelas" and preview["banner"] == media_id
    assert preview["joined"] is False and preview["member_count"] == 1
    assert "invite_code" not in preview
    assert (await budi.get("/v1/social/invites/nope")).status_code == 404

    # 6. Preset maskot Mura resmi diterima tanpa unggahan media disk
    r = await ayu.patch("/v1/social/me/media", json={"avatar": "/avatars/mura/mura-tugas-done.png"})
    assert r.status_code == 200
    assert r.json()["data"]["profile"]["avatar"] == "/avatars/mura/mura-tugas-done.png"

    # Preset ngawur ditolak 404
    assert (await ayu.patch("/v1/social/me/media", json={"avatar": "/avatars/mura/hacker.png"})).status_code == 404


@pytest.mark.asyncio
async def test_deleted_messages_vanish_everywhere():
    ayu, budi = await _user("ayu"), await _user("budi")
    dm = (await ayu.post("/v1/social/dms", json={"username": "budi"})).json()["data"]["conversation"]
    first = (await ayu.post(f"/v1/social/conversations/{dm['id']}/messages", json={"body": "pertama"})).json()["data"]["message"]
    second = (await ayu.post(f"/v1/social/conversations/{dm['id']}/messages", json={"body": "salah kirim"})).json()["data"]["message"]
    reply = (await budi.post(f"/v1/social/conversations/{dm['id']}/messages", json={"body": "hah?", "reply_to_id": second["id"]})).json()["data"]["message"]
    assert reply["reply_to"]["id"] == second["id"]

    await ayu.delete(f"/v1/social/messages/{second['id']}")
    page = (await budi.get(f"/v1/social/conversations/{dm['id']}/messages")).json()["data"]
    assert [m["body"] for m in page["messages"]] == ["pertama", "hah?"]
    assert page["messages"][1]["reply_to"] is None

    await budi.delete(f"/v1/social/messages/{reply['id']}")
    last = (await budi.get("/v1/social/inbox")).json()["data"]["dms"][0]["last_message"]
    assert last["id"] == first["id"] and last["preview"] == "pertama"


@pytest.mark.asyncio
async def test_recent_edits_reported_on_next_open(social_env):
    ayu, budi = await _user("ayu"), await _user("budi")
    dm = (await ayu.post("/v1/social/dms", json={"username": "budi"})).json()["data"]["conversation"]
    mid = (await ayu.post(f"/v1/social/conversations/{dm['id']}/messages", json={"body": "jam 7"})).json()["data"]["message"]["id"]
    first_open = (await budi.get(f"/v1/social/conversations/{dm['id']}/messages")).json()["data"]
    assert first_open["recent_edits"] == []

    import time

    time.sleep(1.1)  # timestamp berresolusi detik
    social_env.clear()
    await ayu.patch(f"/v1/social/messages/{mid}", json={"body": "jam 8"})
    assert next(e for e in social_env if e.type == "message.updated").payload["change"] == "edited"

    reopened = (await budi.get(f"/v1/social/conversations/{dm['id']}/messages")).json()["data"]
    assert [(e["id"], e["author"]["username"], e["preview"]) for e in reopened["recent_edits"]] == [(mid, "ayu", "jam 8")]
    # Sudah dilihat: tidak dilaporkan lagi; editan sendiri tidak pernah dilaporkan ke pengirim.
    assert (await budi.get(f"/v1/social/conversations/{dm['id']}/messages")).json()["data"]["recent_edits"] == []
    assert (await ayu.get(f"/v1/social/conversations/{dm['id']}/messages")).json()["data"]["recent_edits"] == []


@pytest.mark.asyncio
async def test_presence_online_offline_and_audience():
    from app.social import service

    await _user("ayu"), await _user("budi"), await _user("citra")
    ayu = _open_clients[0]
    await ayu.post("/v1/social/dms", json={"username": "budi"})

    event = service.set_presence(NIMS["ayu"], True)
    assert event.type == "presence" and event.payload["online"] is True
    assert set(event.recipients) == {NIMS["ayu"], NIMS["budi"]}  # citra tidak berbagi DM/ruang
    budi_view = (await _open_clients[1].get("/v1/social/inbox")).json()["data"]["dms"][0]["peer"]
    assert budi_view["online"] is True

    service.set_presence(NIMS["ayu"], False)
    budi_view = (await _open_clients[1].get("/v1/social/inbox")).json()["data"]["dms"][0]["peer"]
    assert budi_view["online"] is False and budi_view["last_seen_at"]


def test_migration_adds_columns_to_legacy_db(tmp_path, monkeypatch):
    import sqlite3

    legacy = tmp_path / "legacy.db"
    conn = sqlite3.connect(legacy)
    conn.executescript(
        "CREATE TABLE social_profiles (nim TEXT PRIMARY KEY, username TEXT, display_name TEXT, bio TEXT, created_at TEXT, last_seen_at TEXT);"
        "CREATE TABLE social_spaces (id INTEGER PRIMARY KEY, name TEXT, description TEXT, owner_nim TEXT, invite_code TEXT, is_public INTEGER, created_at TEXT);"
        "CREATE TABLE social_participants (conversation_id INTEGER, nim TEXT, last_read_id INTEGER, PRIMARY KEY (conversation_id, nim));"
    )
    conn.close()
    monkeypatch.setattr("app.config.settings.SQLITE_DB_PATH", str(legacy))
    from app.social.db import init_social_db

    init_social_db()
    init_social_db()  # idempoten
    conn = sqlite3.connect(legacy)
    cols = {r[1] for r in conn.execute("PRAGMA table_info(social_profiles)")}
    assert {r[1] for r in conn.execute("PRAGMA table_info(social_profiles)")} >= {"avatar", "banner", "is_online"}
    assert "last_opened_at" in {r[1] for r in conn.execute("PRAGMA table_info(social_participants)")}
    conn.close()


# ------------------------------------------------------------------ v3: pengaturan grup

@pytest.mark.asyncio
async def test_rename_default_channel_and_announcement_mode():
    ayu, budi = await _user("ayu"), await _user("budi")
    space = (await ayu.post("/v1/social/spaces", json={"name": "Kelas"})).json()["data"]["space"]
    general = space["channels"][0]
    await budi.post("/v1/social/spaces/join", json={"invite_code": space["invite_code"]})

    renamed = (await ayu.patch(f"/v1/social/conversations/{general['id']}", json={"name": "Info Kelas"})).json()["data"]["channel"]
    assert renamed["name"] == "info-kelas"

    ann = (await ayu.patch(f"/v1/social/conversations/{general['id']}", json={"admin_only": True})).json()["data"]["channel"]
    assert ann["admin_only"] is True
    blocked = await budi.post(f"/v1/social/conversations/{general['id']}/messages", json={"body": "halo"})
    assert blocked.status_code == 403 and blocked.json()["error"]["code"] == "CHANNEL_READ_ONLY"
    assert (await ayu.post(f"/v1/social/conversations/{general['id']}/messages", json={"body": "Pengumuman"})).status_code == 201
    # Anggota biasa tidak bisa mengubah channel.
    assert (await budi.patch(f"/v1/social/conversations/{general['id']}", json={"admin_only": False})).status_code == 403


@pytest.mark.asyncio
async def test_reorder_channels_requires_exact_set():
    ayu = await _user("ayu")
    space = (await ayu.post("/v1/social/spaces", json={"name": "Kelas"})).json()["data"]["space"]
    first = space["channels"][0]["id"]
    second = (await ayu.post(f"/v1/social/spaces/{space['id']}/channels", json={"name": "tugas"})).json()["data"]["channel"]["id"]

    res = await ayu.post(f"/v1/social/spaces/{space['id']}/channels/order", json={"ids": [second, first]})
    assert [c["id"] for c in res.json()["data"]["space"]["channels"]] == [second, first]
    bad = await ayu.post(f"/v1/social/spaces/{space['id']}/channels/order", json={"ids": [second]})
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_private_spaces_hidden_from_discover_and_public_join_blocked():
    ayu, budi = await _user("ayu"), await _user("budi")
    private = (await ayu.post("/v1/social/spaces", json={"name": "Rahasia Kelompok"})).json()["data"]["space"]
    public = (await ayu.post("/v1/social/spaces", json={"name": "Rahasia Terbuka", "is_public": True})).json()["data"]["space"]
    found = (await budi.get("/v1/social/spaces/discover", params={"q": "rahasia"})).json()["data"]["spaces"]
    assert [s["id"] for s in found] == [public["id"]]
    assert "online_count" in found[0] and "invite_code" not in found[0]
    # Privat hanya lewat link undangan.
    assert (await budi.post(f"/v1/social/spaces/{private['id']}/join")).status_code == 404
    assert (await budi.post("/v1/social/spaces/join", json={"invite_code": private["invite_code"]})).status_code == 200
