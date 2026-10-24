import asyncio
import html
import json
import logging
import re
import time
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Path, Query, Request, status
from scrapling.fetchers import Fetcher

from app.config import settings
from app.envelope import success_response, error_response
from app.cache import cache
from app.router_helper import cached_endpoint
from app.proxy import get_proxy
from app.session_store import session_store
from app.modules.studentv2 import parse_announcements, parse_schedule, studentv2_client
from app.channels_db import list_active_by_category

logger = logging.getLogger("app.notifications")

# Pengingat H-1 (WIB): kirim pertama 19:00, reminder 21:00. Tambah jam di sini bila perlu.
H1_REMINDER_HOURS = (19, 21)


def _h1_slot(now: Optional[datetime] = None) -> Optional[int]:
    """Slot pengingat H-1 yang sudah aktif (WIB). None = di luar jam pengingat."""
    from zoneinfo import ZoneInfo

    current = now or datetime.now(ZoneInfo("Asia/Jakarta"))
    eligible = [h for h in H1_REMINDER_HOURS if current.hour >= h]
    return eligible[-1] if eligible else None

router = APIRouter(prefix="/v1/news", tags=["news"])

def clean_html_text(raw: str) -> str:
    if not raw:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw)
    text = text.replace("&#8217;", "'").replace("&#8211;", "-").replace("&amp;", "&").replace("&quot;", '"')
    text = text.replace("[&hellip;]", "...").replace("&hellip;", "...").replace("&#8230;", "...")
    return " ".join(text.split()).strip()

def parse_wp_posts(raw_posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results = []
    for p in raw_posts:
        p_id = str(p.get("id", ""))
        title = clean_html_text(p.get("title", {}).get("rendered", ""))
        link = p.get("link", "")
        date = p.get("date", "")
        
        embedded = p.get("_embedded", {})
        authors = embedded.get("author", [])
        author = authors[0].get("name", "Redaksi") if authors else "Redaksi"
        
        media = embedded.get("wp:featuredmedia", [])
        featured_image = media[0].get("source_url") if media else None
        
        excerpt = clean_html_text(p.get("excerpt", {}).get("rendered", ""))

        results.append({
            "id": p_id,
            "title": title,
            "date": date,
            "link": link,
            "author": author,
            "featured_image": featured_image,
            "excerpt": excerpt,
        })
    return results

def parse_wp_post_detail(p: dict[str, Any]) -> dict[str, Any]:
    p_id = str(p.get("id", ""))
    title = clean_html_text(p.get("title", {}).get("rendered", ""))
    link = p.get("link", "")
    date = p.get("date", "")
    
    embedded = p.get("_embedded", {})
    authors = embedded.get("author", [])
    author = authors[0].get("name", "Redaksi") if authors else "Redaksi"
    
    media = embedded.get("wp:featuredmedia", [])
    featured_image = media[0].get("source_url") if media else None
    
    content = p.get("content", {}).get("rendered", "")
    excerpt = clean_html_text(p.get("excerpt", {}).get("rendered", ""))

    return {
        "id": p_id,
        "title": title,
        "date": date,
        "link": link,
        "author": author,
        "featured_image": featured_image,
        "excerpt": excerpt,
        "content": content,
    }

class NewsClient:
    BASE_URL = "https://news.bsi.ac.id/wp-json/wp/v2"

    def fetch_posts(self, search: Optional[str] = None, page: int = 1, per_page: int = 10) -> list[dict[str, Any]]:
        params = f"_embed=1&page={page}&per_page={per_page}"
        if search:
            safe_search = urllib.parse.quote_plus(search)
            params += f"&search={safe_search}"
        url = f"{self.BASE_URL}/posts?{params}"

        try:
            res = Fetcher.get(url, timeout=20, impersonate="chrome", proxy=get_proxy())
            if res.status == 200:
                if hasattr(res, "json") and callable(res.json):
                    return res.json()
                raw = res.body.decode("utf-8", "ignore") if isinstance(res.body, bytes) else str(res.body)
                return json.loads(raw)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(
                    code="UPSTREAM_ERROR",
                    message=f"WordPress REST API mengembalikan status {res.status}",
                    module="news"
                )
            )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.warning("Gagal mengambil berita: %s", e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(code="UPSTREAM_ERROR", message="Layanan berita kampus sedang mengalami gangguan atau timeout", module="news")
            )

    def fetch_post_detail(self, post_id: str) -> dict[str, Any]:
        url = f"{self.BASE_URL}/posts/{post_id}?_embed=1"
        try:
            res = Fetcher.get(url, timeout=20, impersonate="chrome", proxy=get_proxy())
            if res.status == 200:
                if hasattr(res, "json") and callable(res.json):
                    return res.json()
                raw = res.body.decode("utf-8", "ignore") if isinstance(res.body, bytes) else str(res.body)
                return json.loads(raw)
            if res.status == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_response(code="NOT_FOUND", message="Berita tidak ditemukan", module="news")
                )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(code="UPSTREAM_ERROR", message=f"Status {res.status}", module="news")
            )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.warning("Gagal mengambil detail berita %s: %s", post_id, e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_response(code="UPSTREAM_ERROR", message="Gagal mengambil detail artikel berita kampus", module="news")
            )

news_client = NewsClient()

@router.get("")
async def get_news(
    search: Optional[str] = Query(default=None, max_length=100, description="Kata kunci pencarian berita"),
    page: int = Query(default=1, ge=1, le=200, description="Nomor halaman"),
    per_page: int = Query(default=10, ge=1, le=50, description="Jumlah item per halaman")
):
    loop = asyncio.get_running_loop()
    return await cached_endpoint(
        module="news",
        name="posts",
        fetch=lambda: loop.run_in_executor(None, news_client.fetch_posts, search, page, per_page),
        parse=parse_wp_posts,
        ttl=settings.TTL_NEWS,
        cache_params={"search": search, "page": page, "per_page": per_page},
    )

@router.get("/{post_id}")
async def get_news_detail(post_id: str = Path(..., pattern=r"^[0-9]+$")):
    loop = asyncio.get_running_loop()
    return await cached_endpoint(
        module="news",
        name="detail",
        fetch=lambda: loop.run_in_executor(None, news_client.fetch_post_detail, post_id),
        parse=parse_wp_post_detail,
        ttl=settings.TTL_NEWS,
        cache_params={"post_id": post_id},
    )

# News and user notification dispatch (Discord, Telegram, Custom)

_DAY_NAMES = ("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu")


def _h1_window_open(now: Optional[datetime] = None) -> bool:
    """Pengingat 'kuliah besok' hanya slot 19:00 & 21:00 WIB (tiap slot kirim sekali)."""
    return _h1_slot(now) is not None


def build_schedule_notification(
    courses: list[dict[str, Any]], now: Optional[datetime] = None
) -> Optional[dict[str, Any]]:
    """Build one H-1 payload from courses scheduled for tomorrow in WIB."""
    from zoneinfo import ZoneInfo

    current = now or datetime.now(ZoneInfo("Asia/Jakarta"))
    if current.tzinfo is None:
        current = current.replace(tzinfo=ZoneInfo("Asia/Jakarta"))
    tomorrow = _DAY_NAMES[(current.astimezone(ZoneInfo("Asia/Jakarta")).weekday() + 1) % 7]
    matches = [course for course in courses if str(course.get("hari", "")).strip().lower() == tomorrow.lower()]
    if not matches:
        return None
    lines = [
        f"- {course.get('nama', 'Mata kuliah')} | {course.get('jam', 'Jam belum tersedia')} | Ruang {course.get('ruang', '-') }"
        for course in matches
    ]
    return {
        "category": "matkul-besok",
        "title": f"Jadwal Kuliah Besok: {tomorrow}",
        "description": "\n".join(lines),
        "link": f"{settings.WEB_BASE_URL}/dashboard/jadwal",
    }


async def _dispatch_user_channel(channel: dict[str, Any], payload: dict[str, Any]) -> bool:
    config = channel["config"]
    if channel["type"] == "discord":
        return await dispatch_discord_webhook(payload, config["url"])
    if channel["type"] == "telegram":
        return await dispatch_telegram_message(payload, config["bot_token"], config["chat_id"])
    return await dispatch_webhook_notification(payload, config["url"])


async def _produce_user_category(
    category: str, assignment_fetch_cache: Optional[dict[str, tuple[str, str]]] = None
) -> int:
    from app.notifier import deliver
    from app.pwa_push_db import list_nims_with_category

    channels = await list_active_by_category(category)
    # Penerima = pemilik webhook channel + pelanggan push PWA yang mengaktifkan kategori ini.
    try:
        pwa_nims = [str(n) for n in await list_nims_with_category(category)]
    except Exception:
        logger.exception("Gagal membaca pelanggan push PWA untuk kategori %s", category)
        pwa_nims = []
    nims: list[str] = []
    for nim in [str(c["nim"]) for c in channels] + pwa_nims:
        if nim not in nims:
            nims.append(nim)
    if not nims:
        return 0
    redis = await cache.get_client()
    sent = 0
    for nim in nims:
        slot_suffix = ""  # hanya matkul-besok yang di-suffix slot pengingat
        credentials = await session_store.get_credentials_for_nim(nim)
        if not credentials:
            from app.api_keys_db import get_credentials_for_nim
            credentials = await get_credentials_for_nim(nim)
        if not credentials:
            continue
        _, student_password, elearning_password = credentials
        try:
            payload = None
            claimed_quiz_ids: list[str] = []
            if category == "matkul-besok":
                h1_slot = _h1_slot()
                if h1_slot is None:
                    continue
                slot_suffix = f":h{h1_slot}"
                raw = await studentv2_client.fetch_page("/mahasiswa/jadwal-kuliah", nim, student_password)
                payload = build_schedule_notification(parse_schedule(raw))
            elif category == "pengumuman-siakad":
                raw = await studentv2_client.fetch_page("/mahasiswa/beranda", nim, student_password)
                announcements = parse_announcements(raw)
                if announcements:
                    latest = announcements[0]
                    payload = {
                        "category": category,
                        "title": f"Pengumuman SIAKAD: {latest['title']}",
                        "description": "Ada pengumuman akademik baru di SIAKAD UBSI.",
                        "link": latest.get("pdf_url") or f"{settings.WEB_BASE_URL}/dashboard/berita",
                    }
            elif category in ("quiz-tugas", "tugas-baru"):
                from app.modules.elearning import parse_assignments, parse_courses, parse_quiz, pooled_elearning_client
                from app.notifier import _claim, _release

                # quiz-tugas dan tugas-baru baca halaman sama: fetch sekali per siklus per NIM
                if assignment_fetch_cache is not None and nim in assignment_fetch_cache:
                    raw_quiz, raw_assignments = assignment_fetch_cache[nim]
                else:
                    raw_quiz = await pooled_elearning_client.fetch_page("/exercise", nim, elearning_password)
                    raw_assignments = await pooled_elearning_client.fetch_page("/sch", nim, elearning_password)
                    if assignment_fetch_cache is not None:
                        assignment_fetch_cache[nim] = (raw_quiz, raw_assignments)
                quiz_items = parse_quiz(raw_quiz)
                # Kuis BARU per item (id = hash paket:waktu), bukan agregat jumlah:
                # agregat salah dua arah (kuis baru + lama hilang = angka sama -> diam).
                new_quizzes: list[dict[str, Any]] = []
                for q in quiz_items:
                    qid = q.get("id")
                    if not qid:
                        continue
                    if await _claim(f"ubsi:notify:quizseen:{nim}:{qid}", 7 * 24 * 3600):
                        claimed_quiz_ids.append(qid)
                        new_quizzes.append(q)
                task_count = 0
                for course in parse_courses(raw_assignments):
                    token_assignment = course.get("token_assignment")
                    if token_assignment:
                        task_html = await pooled_elearning_client.fetch_page(f"/assignment/{token_assignment}", nim, elearning_password)
                        task_count += len(parse_assignments(task_html).get("tasks", []))
                if new_quizzes:
                    names = ", ".join(str(q.get("paket")) for q in new_quizzes[:3])
                    more = f" +{len(new_quizzes) - 3} lainnya" if len(new_quizzes) > 3 else ""
                    payload = {
                        "category": category,
                        "title": f"Kuis Baru ({len(new_quizzes)})",
                        "description": f"Kuis baru di MyBest: {names}{more}. Kerjakan sebelum waktu ujiannya berakhir.",
                        "link": f"{settings.WEB_BASE_URL}/dashboard/kuis",
                    }
                elif task_count:
                    payload = {
                        "category": category,
                        "title": "Tugas dan kuis MyBest tersedia",
                        "description": f"Tersedia {task_count} tugas di MyBest. Periksa dashboard sebelum tenggat.",
                        "link": f"{settings.WEB_BASE_URL}/dashboard/tugas",
                    }
            elif category == "nilai-keluar":
                from app.modules.studentv2 import parse_grades
                raw_grades = await studentv2_client.fetch_page("/mahasiswa/nilai-murni", nim, student_password)
                grades = parse_grades(raw_grades)
                graded = [g for g in grades if g.get("grade")]
                if graded:
                    target = graded[0]
                    payload = {
                        "category": category,
                        "title": f"Nilai Dirilis: {target['nama']}",
                        "description": f"Nilai akhir mata kuliah {target['nama']} ({target['kode']}) telah dirilis di SIAKAD: Grade {target['grade']} (Total: {target.get('total')}).",
                        "link": f"{settings.WEB_BASE_URL}/dashboard/nilai",
                    }
            elif category == "jadwal-ujian":
                from app.modules.studentv2 import parse_uts, parse_uas
                raw_uts = await studentv2_client.fetch_page("/mahasiswa/uts", nim, student_password)
                raw_uas = await studentv2_client.fetch_page("/mahasiswa/uas", nim, student_password)
                uts = parse_uts(raw_uts)
                uas = parse_uas(raw_uas)
                if uts.get("jadwal_online_url") or uts.get("soal_offline_url"):
                    payload = {
                        "category": category,
                        "title": "Jadwal & Ruang UTS Telah Diumumkan",
                        "description": "Informasi jadwal ruang ujian tengah semester (UTS) telah dirilis di SIAKAD. Periksa jadwal dan persiapan ujian Anda.",
                        "link": f"{settings.WEB_BASE_URL}/dashboard/ujian",
                    }
                elif uas.get("jadwal_online_url") or uas.get("soal_offline_url"):
                    payload = {
                        "category": category,
                        "title": "Jadwal & Ruang UAS Telah Diumumkan",
                        "description": "Informasi jadwal ruang ujian akhir semester (UAS) telah dirilis di SIAKAD. Periksa jadwal dan persiapan ujian Anda.",
                        "link": f"{settings.WEB_BASE_URL}/dashboard/ujian",
                    }
            if not payload:
                continue
            from zoneinfo import ZoneInfo
            from app.notifier import _claim, _release

            now_wib = datetime.now(ZoneInfo("Asia/Jakarta"))
            date_key = now_wib.date().isoformat()
            dedupe_key = f"ubsi:notify:sent:{nim}:{category}:{date_key}" + slot_suffix
            # Klaim atomik (SET NX) sebelum deliver: anti dobel saat 2 worker bangun bareng
            if not await _claim(dedupe_key, 172800):
                continue
            import hashlib
            content_key = "ubsi:notify:content:%s:%s:%s" % (
                nim, hashlib.sha1((payload["title"] + payload["description"]).encode()).hexdigest()[:16], date_key
            ) + slot_suffix
            if not await _claim(content_key, 172800):
                continue  # kategori berbeda dengan isi sama (mis. quiz-tugas dan tugas-baru): kirim sekali
            matching = [item for item in channels if str(item["nim"]) == nim]
            try:
                delivered = await deliver(
                    nim, category, payload["title"], payload["description"], payload["link"],
                    tag=category if category not in ("quiz-tugas", "tugas-baru") else "tugas-kuis",
                    ttl=21600, channels=matching,
                )
            except Exception:
                await _release(dedupe_key)
                await _release(content_key)
                for qid in claimed_quiz_ids:
                    await _release(f"ubsi:notify:quizseen:{nim}:{qid}")
                raise
            if delivered:
                sent += 1
            else:
                # Gagal total: lepas klaim supaya slot berikutnya bisa mencoba lagi
                await _release(dedupe_key)
                await _release(content_key)
                for qid in claimed_quiz_ids:
                    await _release(f"ubsi:notify:quizseen:{nim}:{qid}")
        except Exception:
            logger.exception("User notification producer failed for NIM %s category %s", nim, category)
    return sent


async def poll_user_notifications() -> int:
    """Produce account-scoped notifications from existing authenticated data sources."""
    total = 0
    assignment_fetch_cache: dict[str, tuple[str, str]] = {}  # nim -> (raw_quiz, raw_assignments)
    for category in (
        "matkul-besok",
        "quiz-tugas",
        "tugas-baru",
        "pengumuman-siakad",
        "nilai-keluar",
        "jadwal-ujian",
    ):
        # Satu kategori crash tidak boleh membunuh kategori berikutnya
        try:
            total += await _produce_user_category(category, assignment_fetch_cache)
        except Exception:
            logger.exception("Kategori notifikasi %s gagal diproses", category)
    return total


async def dispatch_webhook_notification(
    post: dict[str, Any], webhook_url: str, event: str = "news.published"
) -> bool:
    """Kirim generic JSON payload ke custom webhook URL."""
    if not await asyncio.to_thread(is_safe_webhook_url, webhook_url):
        logger.warning("Unsafe custom webhook URL blocked at dispatch: %s", webhook_url)
        return False
    payload = {
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": post,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as client:
            res = await client.post(webhook_url, json=payload)
            return res.is_success
    except Exception:
        return False

async def dispatch_discord_webhook(post: dict[str, Any], webhook_url: str) -> bool:
    """Kirim rich embed ke Discord Webhook."""
    title = (post.get("title") or "Berita Baru UBSI")[:256]
    description = (post.get("description") or post.get("excerpt") or "")[:4000]
    author_name = (post.get("author") or "Redaksi")[:256]

    embed: dict[str, Any] = {
        "title": title,
        "url": post.get("link", ""),
        "description": description,
        "color": 0x2DD4BF,  # Teal #2DD4BF
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "footer": {"text": f"Oleh: {author_name} • UBSI News Portal"},
    }
    if post.get("featured_image"):
        embed["image"] = {"url": post["featured_image"]}

    payload = {
        "username": "UBSI News",
        "avatar_url": f"{settings.WEB_BASE_URL}/assets/images/brand-logos/logo_bsi.png",
        "embeds": [embed],
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(webhook_url, json=payload)
            return res.is_success
    except Exception:
        return False

async def dispatch_telegram_message(post: dict[str, Any], bot_token: str, chat_id: str) -> bool:
    """Kirim pesan HTML dengan foto (jika ada) ke Telegram via Bot API."""
    raw_title = post.get("title", "Berita Kampus UBSI")
    raw_excerpt = post.get("description") or post.get("excerpt", "")
    raw_author = post.get("author", "Redaksi")
    date = post.get("date", "")
    link = post.get("link", "https://news.bsi.ac.id")
    image_url = post.get("featured_image")

    # Escape karakter khusus HTML agar Telegram Bot API tidak melempar 400 Bad Request
    safe_link = html.escape(str(link), quote=True)
    title = html.escape(raw_title, quote=True)
    excerpt = html.escape(raw_excerpt, quote=True)
    author = html.escape(raw_author, quote=True)

    caption = (
        f"📰 <b><a href=\"{safe_link}\">{title}</a></b>\n\n"
        f"{excerpt}\n\n"
        f"✍️ <i>{author}</i> • 📅 {date}\n"
        f"🔗 <a href=\"{safe_link}\">Baca Selengkapnya di Portal Berita</a>"
    )

    base_url = f"https://api.telegram.org/bot{bot_token}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if image_url:
                res = await client.post(
                    f"{base_url}/sendPhoto",
                    json={
                        "chat_id": chat_id,
                        "photo": image_url,
                        "caption": caption[:1024],
                        "parse_mode": "HTML",
                    },
                )
                if res.is_success:
                    return True
            # Fallback sendMessage jika tanpa gambar atau sendPhoto gagal
            res2 = await client.post(
                f"{base_url}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": caption[:4096],
                    "parse_mode": "HTML",
                    "disable_web_page_preview": False,
                },
            )
            return res2.is_success
    except Exception:
        return False

async def broadcast_news_article(post: dict[str, Any]) -> dict[str, bool]:
    """Fan-out berita ke channel admin (env) + channel user terdaftar."""
    tasks: dict[str, Any] = {}

    if settings.DISCORD_WEBHOOK_URL:
        tasks["discord"] = dispatch_discord_webhook(post, settings.DISCORD_WEBHOOK_URL)
    if settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
        tasks["telegram"] = dispatch_telegram_message(post, settings.TELEGRAM_BOT_TOKEN, settings.TELEGRAM_CHAT_ID)
    if settings.NEWS_WEBHOOK_URL:
        tasks["custom"] = dispatch_webhook_notification(post, settings.NEWS_WEBHOOK_URL)

    # Channel per-user (dashboard login BSI) dengan kategori berita-kampus
    try:
        from app.channels_db import list_active_by_category

        user_channels = await list_active_by_category("berita-kampus")
        for channel in user_channels:
            config = channel["config"]
            channel_key = f"user:{channel['id']}"
            if channel["type"] == "discord":
                tasks[channel_key] = dispatch_discord_webhook(post, config["url"])
            elif channel["type"] == "telegram":
                tasks[channel_key] = dispatch_telegram_message(
                    post, config["bot_token"], config["chat_id"]
                )
            else:
                tasks[channel_key] = dispatch_webhook_notification(post, config["url"])
    except Exception:
        # SQLite down / belum ada tabel: tetap kirim ke channel admin
        pass

    # PWA Web Push: kategori terikat akun, broadcast ke semua device NIM terkait
    try:
        from app.pwa_webpush import dispatch_pwa_to_category

        tasks["pwa-push"] = dispatch_pwa_to_category(
            "berita-kampus",
            {
                "title": f"Berita Kampus: {post.get('title', 'Artikel Baru')}"[:120],
                "body": (post.get("description") or "Ada artikel baru di portal berita UBSI.")[:200],
                "url": post.get("link") or "/dashboard/berita",
                "tag": "berita-kampus",
            },
        )
    except Exception:
        # VAPID belum dikonfigurasi / SQLite down: broadcast berita tetap lanjut
        pass

    if not tasks:
        return {}

    keys = list(tasks.keys())
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    return {k: (bool(r) and not isinstance(r, Exception)) for k, r in zip(keys, results)}

async def poll_news_webhook() -> int:
    """Cek artikel berita baru dan broadcast ke seluruh channel aktif."""
    from app.channels_db import list_active_by_category

    user_channels = []
    try:
        user_channels = await list_active_by_category("berita-kampus")
    except Exception:
        pass

    # PWA push subscribers juga dihitung sebagai channel (tanpa webhook eksternal)
    pwa_has_subscribers = False
    try:
        from app.pwa_push_db import list_nims_with_category

        pwa_has_subscribers = bool(await list_nims_with_category("berita-kampus"))
    except Exception:
        pass

    has_channel = bool(
        settings.DISCORD_WEBHOOK_URL
        or (settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)
        or settings.NEWS_WEBHOOK_URL
        or user_channels
        or pwa_has_subscribers
    )
    if not has_channel:
        return 0

    redis = await cache.get_client()
    key_seen = "ubsi:news:seen_ids"

    loop = asyncio.get_running_loop()
    try:
        raw_posts = await loop.run_in_executor(None, news_client.fetch_posts, None, 1, 5)
        posts = parse_wp_posts(raw_posts)
    except Exception:
        logger.exception("Gagal fetch/parse berita di poll_news_webhook")
        return 0

    if not posts:
        return 0

    # Cold start: seed IDs tanpa mengirim spam
    exists = await redis.exists(key_seen)
    if not exists:
        ids = [p["id"] for p in posts if p.get("id")]
        if ids:
            await redis.sadd(key_seen, *ids)
            await redis.expire(key_seen, 86400 * 30)
        return 0

    dispatched_count = 0
    for p in reversed(posts):
        p_id = p.get("id")
        if not p_id:
            continue
        claimed = await redis.sadd(key_seen, p_id)
        if claimed:
            results = await broadcast_news_article(p)
            if any(results.values()):
                dispatched_count += 1
            else:
                await redis.srem(key_seen, p_id)

    return dispatched_count

async def news_webhook_worker():
    interval = max(30, int(settings.NEWS_WEBHOOK_INTERVAL))
    while True:
        try:
            # Leader lock: produksi jalan --workers 2, cukup satu worker per siklus
            from app.notifier import _claim

            cycle = int(time.time()) // interval
            if await _claim(f"ubsi:worker:news:{cycle}", interval * 2):
                await poll_news_webhook()
                await poll_user_notifications()
        except Exception:
            logger.exception("Notification worker iteration failed")
        await asyncio.sleep(settings.NEWS_WEBHOOK_INTERVAL)

def is_safe_webhook_url(url_str: str) -> bool:
    """Allow HTTPS public webhook targets and reject every private resolution."""
    import ipaddress
    import socket

    try:
        parsed = urllib.parse.urlparse(url_str)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            return False
        hostname = parsed.hostname.rstrip(".").lower()
        if hostname == "localhost" or hostname.endswith(".localhost"):
            return False
        addresses = {info[4][0] for info in socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM)}
        return bool(addresses) and all(
            (ip := ipaddress.ip_address(address)).is_global
            and not ip.is_private
            and not ip.is_loopback
            and not ip.is_link_local
            and not ip.is_reserved
            and not ip.is_multicast
            for address in addresses
        )
    except (OSError, ValueError):
        return False

@router.post("/webhook/test")
async def test_news_webhook(
    request: Request,
    channel: str = Query(default="all", pattern=r"^(all|discord|telegram|custom)$", description="Channel target: all, discord, telegram, custom"),
    target_url: Optional[str] = Query(default=None, description="URL target override (khusus custom/discord)"),
    telegram_bot_token: Optional[str] = Query(default=None, description="Bot token override (khusus telegram)"),
    telegram_chat_id: Optional[str] = Query(default=None, description="Chat ID override (khusus telegram)")
):
    """Kirim payload uji coba ke Discord, Telegram, atau Custom Webhook."""
    if not getattr(request.state, "is_master", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_response(
                code="FORBIDDEN",
                message="Endpoint uji coba webhook hanya dapat diakses menggunakan Master Key",
                module="news"
            )
        )

    if target_url and not await asyncio.to_thread(is_safe_webhook_url, target_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="INVALID_URL",
                message="target_url tidak valid atau mengarah ke alamat jaringan privat yang dilarang (anti-SSRF)",
                module="news"
            )
        )
    sample_post = {
        "id": "test_99999",
        "title": "Uji Coba Notifikasi Berita Kampus UBSI",
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "link": "https://news.bsi.ac.id/sample-article",
        "author": "Redaksi UBSI API",
        "featured_image": "https://news.bsi.ac.id/wp-content/uploads/2026/09/banner.jpg",
        "excerpt": "Ini adalah payload contoh verifikasi koneksi broadcast webhook multi-channel dari UBSI API.",
    }

    results: dict[str, Any] = {}
    if channel in ("all", "discord"):
        discord_url = target_url or settings.DISCORD_WEBHOOK_URL
        if discord_url:
            ok = await dispatch_discord_webhook(sample_post, discord_url)
            results["discord"] = {"configured": True, "success": ok}
        else:
            results["discord"] = {"configured": False, "message": "DISCORD_WEBHOOK_URL belum disetel"}

    if channel in ("all", "telegram"):
        tg_token = telegram_bot_token or settings.TELEGRAM_BOT_TOKEN
        tg_chat = telegram_chat_id or settings.TELEGRAM_CHAT_ID
        if tg_token and tg_chat:
            ok = await dispatch_telegram_message(sample_post, tg_token, tg_chat)
            results["telegram"] = {"configured": True, "success": ok, "chat_id": tg_chat}
        else:
            results["telegram"] = {"configured": False, "message": "TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum disetel"}

    if channel in ("all", "custom"):
        custom_url = target_url or settings.NEWS_WEBHOOK_URL
        if custom_url:
            ok = await dispatch_webhook_notification(sample_post, custom_url)
            results["custom"] = {"configured": True, "success": ok}
        else:
            results["custom"] = {"configured": False, "message": "NEWS_WEBHOOK_URL belum disetel"}

    any_configured = any(r.get("configured") for r in results.values())
    if not any_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                code="CONFIG_MISSING",
                message=f"Tidak ada konfigurasi aktif untuk channel '{channel}'. Setel di .env atau kirim parameter target_url.",
                module="news"
            )
        )

    return success_response(data={"message": f"Pengujian broadcast channel '{channel}' selesai", "results": results})
