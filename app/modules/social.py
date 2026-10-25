"""Router Mira Komunitas (/v1/social): ruang + channel ala Discord, DM ala Telegram.

Router ini sengaja tipis: validasi bentuk request (Pydantic), panggil
`app.social.service` di threadpool, lalu fan-out event realtime setelah commit.
Akses hanya untuk session dashboard mahasiswa (bukan Master Key / API key)
supaya tidak ada bot atau skrip massal yang ikut mengobrol.
"""
from typing import Any, Callable, Literal, Optional

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

from app.envelope import error_response, success_response
from app.limiter import limiter
from app.social import events, service
from app.social.service import Outcome, SocialError

router = APIRouter(prefix="/v1/social", tags=["social"])

_SEND_LIMIT_PER_MINUTE = 30


def _session_nim(request: Request) -> str:
    nim = getattr(request.state, "nim", None)
    if not nim or getattr(request.state, "auth_type", "") != "session":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_response(
                code="FORBIDDEN",
                message="Komunitas hanya bisa diakses lewat sesi login dashboard",
                module="social",
            ),
        )
    return str(nim)


async def _cached_siakad(nim: str, name: str) -> dict[str, Any]:
    """Baca data SIAKAD dari cache Redis saja (fresh, lalu LGG). Tanpa live hit, fail-open."""
    try:
        from app.cache import cache

        key = cache.make_key("studentv2", name, nim=nim)
        data = await cache.get_fresh(key)
        if data is None:
            lgg = await cache.get_lgg(key)
            data = lgg[0] if lgg else None
        return data or {}
    except Exception:
        return {}


async def _siakad_defaults(nim: str) -> dict[str, str]:
    """Kelas, cabang, dan prodi otomatis dari cache SIAKAD (anti ketik manual, anti palsu)."""
    from app.modules import studentv2 as sv2

    profile = await _cached_siakad(nim, "profile")
    krs = await _cached_siakad(nim, "krs")
    return {
        "class_code": sv2.class_label(profile, krs) or "",
        "campus_branch": sv2.branch_display(profile.get("lokasi_cabang")) or "",
        "major": (profile.get("program_studi") or "").strip(),
    }


async def _call(fn: Callable[..., Any], *args: Any) -> Any:
    """Jalankan service sinkron; terjemahkan SocialError ke envelope HTTP standar."""
    try:
        result = await run_in_threadpool(fn, *args)
    except SocialError as exc:
        raise HTTPException(
            status_code=exc.status,
            detail=error_response(code=exc.code, message=exc.message, module="social"),
        )
    if isinstance(result, Outcome):
        await events.publish(result.events)
        return result.data
    return result


async def _require_send_quota(nim: str) -> None:
    if not await limiter.is_allowed(f"social_send:{nim}", limit=_SEND_LIMIT_PER_MINUTE):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_response(
                code="SLOW_MODE",
                message="Pelan-pelan dulu. Kamu mengirim terlalu banyak pesan dalam satu menit.",
                module="social",
            ),
        )


# ---------------------------------------------------------------- schemas


class ProfileBody(BaseModel):
    username: str = Field(..., min_length=3, max_length=25)
    display_name: str = Field(..., min_length=1, max_length=40)
    bio: str = Field(default="", max_length=160)
    campus_branch: Optional[str] = Field(default=None, max_length=80)
    major: Optional[str] = Field(default=None, max_length=80)
    class_code: Optional[str] = Field(default=None, max_length=20)
    avatar_preset: Optional[str] = Field(default=None, max_length=40)
    show_nim: Optional[bool] = False
    show_class: Optional[bool] = False
    e2ee_public_key: Optional[str] = Field(default=None, max_length=256)


class SpaceBody(BaseModel):
    name: str = Field(..., min_length=2, max_length=40)
    description: str = Field(default="", max_length=200)
    campus_branch: Optional[str] = Field(default=None, max_length=80)
    is_public: bool = False


class SpacePatch(BaseModel):
    name: Optional[str] = Field(default=None, max_length=40)
    description: Optional[str] = Field(default=None, max_length=200)
    campus_branch: Optional[str] = Field(default=None, max_length=80)
    is_public: Optional[bool] = None


class JoinBody(BaseModel):
    invite_code: str = Field(..., min_length=4, max_length=200)


class RoleBody(BaseModel):
    role: Literal["owner", "admin", "member"]


class ChannelBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)
    topic: str = Field(default="", max_length=120)


class ChannelPatch(BaseModel):
    name: Optional[str] = Field(default=None, max_length=40)
    topic: Optional[str] = Field(default=None, max_length=120)


class DmBody(BaseModel):
    username: str = Field(..., min_length=3, max_length=25)


class MessageBody(BaseModel):
    body: str = Field(..., min_length=1, max_length=service.MAX_BODY + 200)
    reply_to_id: Optional[int] = Field(default=None, ge=1)
    card_type: Literal["none", "nilai", "jadwal", "tugas"] = "none"
    card_payload: Optional[dict[str, Any]] = None
    is_encrypted: bool = False
    encryption_nonce: Optional[str] = Field(default=None, max_length=128)


class EditBody(BaseModel):
    body: str = Field(..., min_length=1, max_length=service.MAX_BODY + 200)


class ReadBody(BaseModel):
    message_id: int = Field(..., ge=0)


# ---------------------------------------------------------------- profile & people


@router.get("/me")
async def get_me(request: Request):
    nim = _session_nim(request)
    profile = await _call(service.get_me, nim)
    return success_response(data={"profile": profile, "needs_onboarding": profile is None})


@router.patch("/me")
async def update_me(request: Request, body: ProfileBody):
    nim = _session_nim(request)
    # Auto-fill kelas/cabang/prodi dari cache SIAKAD bila mahasiswa tidak mengisi manual.
    auto = await _siakad_defaults(nim)
    profile = await _call(
        service.upsert_me,
        nim,
        body.username,
        body.display_name,
        body.bio,
        body.campus_branch or auto.get("campus_branch") or None,
        body.major or auto.get("major") or None,
        body.class_code or auto.get("class_code") or None,
        body.avatar_preset,
        body.show_nim,
        body.show_class,
        body.e2ee_public_key,
    )
    return success_response(data={"profile": profile})


@router.get("/users")
async def search_users(request: Request, q: str = ""):
    nim = _session_nim(request)
    users = await _call(service.search_users, nim, q[:40])
    return success_response(data={"users": users})


@router.get("/users/{username}")
async def get_user(username: str):
    return success_response(data={"user": await _call(service.get_user, username)})


# ---------------------------------------------------------------- radar / explore
@router.get("/radar")
async def get_radar(
    request: Request,
    branch: Optional[str] = None,
    major: Optional[str] = None,
    limit: int = 30,
):
    nim = _session_nim(request)
    users = await _call(service.get_radar, nim, branch, major, limit)
    return success_response(data={"users": users})


@router.get("/inbox")
async def get_inbox(request: Request):
    nim = _session_nim(request)
    return success_response(data=await _call(service.inbox, nim))


# ---------------------------------------------------------------- spaces


@router.post("/spaces")
async def create_space(request: Request, body: SpaceBody):
    nim = _session_nim(request)
    space = await _call(service.create_space, nim, body.name, body.description, body.is_public, body.campus_branch)
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=success_response(data={"space": space}))


@router.get("/spaces/discover")
async def discover_spaces(request: Request, q: str = ""):
    nim = _session_nim(request)
    return success_response(data={"spaces": await _call(service.discover_spaces, nim, q[:40])})


@router.post("/spaces/join")
async def join_by_invite(request: Request, body: JoinBody):
    nim = _session_nim(request)
    return success_response(data={"space": await _call(service.join_by_invite, nim, body.invite_code)})


@router.get("/spaces/{space_id}")
async def get_space(request: Request, space_id: int):
    nim = _session_nim(request)
    return success_response(data={"space": await _call(service.get_space, nim, space_id)})


@router.patch("/spaces/{space_id}")
async def update_space(request: Request, space_id: int, body: SpacePatch):
    nim = _session_nim(request)
    space = await _call(
        service.update_space,
        nim,
        space_id,
        body.name,
        body.description,
        body.is_public,
        body.campus_branch,
    )
    return success_response(data={"space": space})


@router.delete("/spaces/{space_id}")
async def delete_space(request: Request, space_id: int):
    nim = _session_nim(request)
    return success_response(data=await _call(service.delete_space, nim, space_id))


@router.post("/spaces/{space_id}/join")
async def join_public(request: Request, space_id: int):
    nim = _session_nim(request)
    return success_response(data={"space": await _call(service.join_public, nim, space_id)})


@router.post("/spaces/{space_id}/leave")
async def leave_space(request: Request, space_id: int):
    nim = _session_nim(request)
    return success_response(data=await _call(service.leave_space, nim, space_id))


@router.post("/spaces/{space_id}/invite/reset")
async def reset_invite(request: Request, space_id: int):
    nim = _session_nim(request)
    return success_response(data={"space": await _call(service.reset_invite, nim, space_id)})


@router.get("/spaces/{space_id}/members")
async def list_members(request: Request, space_id: int):
    nim = _session_nim(request)
    return success_response(data={"members": await _call(service.list_members, nim, space_id)})


@router.patch("/spaces/{space_id}/members/{username}")
async def set_member_role(request: Request, space_id: int, username: str, body: RoleBody):
    nim = _session_nim(request)
    return success_response(data=await _call(service.set_member_role, nim, space_id, username, body.role))


@router.delete("/spaces/{space_id}/members/{username}")
async def kick_member(request: Request, space_id: int, username: str):
    nim = _session_nim(request)
    return success_response(data=await _call(service.kick_member, nim, space_id, username))


@router.post("/spaces/{space_id}/channels")
async def create_channel(request: Request, space_id: int, body: ChannelBody):
    nim = _session_nim(request)
    channel = await _call(service.create_channel, nim, space_id, body.name, body.topic)
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=success_response(data={"channel": channel}))


# ---------------------------------------------------------------- conversations


@router.patch("/conversations/{conversation_id}")
async def update_channel(request: Request, conversation_id: int, body: ChannelPatch):
    nim = _session_nim(request)
    channel = await _call(service.update_channel, nim, conversation_id, body.name, body.topic)
    return success_response(data={"channel": channel})


@router.delete("/conversations/{conversation_id}")
async def delete_channel(request: Request, conversation_id: int):
    nim = _session_nim(request)
    return success_response(data=await _call(service.delete_channel, nim, conversation_id))


@router.post("/dms")
async def open_dm(request: Request, body: DmBody):
    nim = _session_nim(request)
    return success_response(data={"conversation": await _call(service.open_dm, nim, body.username)})


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    request: Request,
    conversation_id: int,
    before: Optional[int] = None,
    after: Optional[int] = None,
    limit: int = service.PAGE_SIZE,
):
    nim = _session_nim(request)
    data = await _call(service.list_messages, nim, conversation_id, before, after, limit)
    return success_response(data=data)


@router.post("/conversations/{conversation_id}/messages")
async def send_message(request: Request, conversation_id: int, body: MessageBody):
    nim = _session_nim(request)
    await _require_send_quota(nim)
    message = await _call(
        service.send_message,
        nim,
        conversation_id,
        body.body,
        body.reply_to_id,
        body.card_type,
        body.card_payload,
        body.is_encrypted,
        body.encryption_nonce,
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=success_response(data={"message": message}))


@router.get("/conversations/{conversation_id}/pins")
async def list_pins(request: Request, conversation_id: int):
    nim = _session_nim(request)
    return success_response(data={"messages": await _call(service.list_pins, nim, conversation_id)})


@router.get("/conversations/{conversation_id}/search")
async def search_messages(request: Request, conversation_id: int, q: str = ""):
    nim = _session_nim(request)
    return success_response(data={"messages": await _call(service.search_messages, nim, conversation_id, q[:80])})


@router.post("/conversations/{conversation_id}/read")
async def mark_read(request: Request, conversation_id: int, body: ReadBody):
    nim = _session_nim(request)
    return success_response(data=await _call(service.mark_read, nim, conversation_id, body.message_id))


@router.post("/conversations/{conversation_id}/typing")
async def typing(request: Request, conversation_id: int):
    nim = _session_nim(request)
    return success_response(data=await _call(service.typing, nim, conversation_id))


# ---------------------------------------------------------------- messages


@router.patch("/messages/{message_id}")
async def edit_message(request: Request, message_id: int, body: EditBody):
    nim = _session_nim(request)
    return success_response(data={"message": await _call(service.edit_message, nim, message_id, body.body)})


@router.delete("/messages/{message_id}")
async def delete_message(request: Request, message_id: int):
    nim = _session_nim(request)
    return success_response(data={"message": await _call(service.delete_message, nim, message_id)})


@router.post("/messages/{message_id}/reactions/{reaction}")
async def toggle_reaction(request: Request, message_id: int, reaction: str):
    nim = _session_nim(request)
    return success_response(data={"message": await _call(service.toggle_reaction, nim, message_id, reaction)})


@router.post("/messages/{message_id}/pin")
async def pin_message(request: Request, message_id: int):
    nim = _session_nim(request)
    return success_response(data={"message": await _call(service.set_pinned, nim, message_id, True)})


@router.delete("/messages/{message_id}/pin")
async def unpin_message(request: Request, message_id: int):
    nim = _session_nim(request)
    return success_response(data={"message": await _call(service.set_pinned, nim, message_id, False)})


# ---------------------------------------------------------------- realtime


def _stream_unavailable(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=error_response(code="STREAM_UNAVAILABLE", message=message, module="social"),
    )


@router.get("/stream")
async def stream(request: Request):
    """Server-Sent Events per pengguna. Klien fallback ke polling bila 503."""
    nim = _session_nim(request)
    if not events.stream_slot_available():
        raise _stream_unavailable("Server realtime sedang penuh, beralih ke mode hemat")
    try:
        subscription = await events.Subscription.open(nim)
    except Exception:
        raise _stream_unavailable("Realtime tidak tersedia, beralih ke mode hemat")

    await run_in_threadpool(service.touch_seen, nim)

    async def body():
        try:
            yield "retry: 3000\n\n"
            yield "event: ready\ndata: {}\n\n"
            async for item in subscription.iterate():
                if await request.is_disconnected():
                    break
                if item is None:
                    await run_in_threadpool(service.touch_seen, nim)
                    yield ": ping\n\n"
                else:
                    yield f"data: {item}\n\n"
        finally:
            await subscription.close()

    return StreamingResponse(
        body(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
        # Jaring pengaman kalau klien putus sebelum generator sempat berjalan (close idempoten).
        background=BackgroundTask(subscription.close),
    )
