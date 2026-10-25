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
    assert msg["author"] == {"username": "ayu", "display_name": "Ayu"}

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

    assert (await budi.post(f"/v1/social/messages/{mid}/reactions/rocket")).status_code == 400
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

    # Budi kirim DM ke Ayu berisi Kartu Nilai (card_type: nilai)
    conv = (await budi.post("/v1/social/dms", json={"username": "ayu"})).json()["data"]["conversation"]
    res_msg = await budi.post(
        f"/v1/social/conversations/{conv['id']}/messages",
        json={
            "body": "Nih cek nilai semester 1 gw!",
            "card_type": "nilai",
            "card_payload": {"ipk": "3.92", "sks": 18, "predikat": "Dengan Pujian"},
        },
    )
    assert res_msg.status_code == 201
    msg = res_msg.json()["data"]["message"]
    assert msg["card_type"] == "nilai"
    assert msg["card_payload"]["ipk"] == "3.92"

