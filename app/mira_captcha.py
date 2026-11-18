"""CAPTCHA Mira: tantangan SVG buatan sendiri sebagai gate form login.

Muncul otomatis saat halaman login terbuka (tanpa perlu NIM). Jawaban disimpan
di Redis dengan TTL; tantangan hanya terhapus saat jawaban cocok, jadi salah
ketik tidak menggugurkan tantangan (user cukup mengoreksi kode). Perbandingan
bersifat case-insensitive agar ramah di ponsel.
"""
import base64
import json
import secrets

from app.cache import cache

MIRA_CAPTCHA_TTL_SECONDS = 600
_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # tanpa 0O1I agar mudah dibaca
_CODE_LENGTH = 5

# Hapus tantangan hanya saat jawaban cocok. Return: raw JSON saat cocok,
# "" saat salah, -1 saat tantangan tidak ada/kedaluwarsa.
_VERIFY_LUA = (
    "local raw = redis.call('GET', KEYS[1]); "
    "if not raw then return -1 end; "
    "local ok, stored = pcall(cjson.decode, raw); "
    "if not ok then redis.call('DEL', KEYS[1]); return '' end; "
    "local answer = string.upper(stored.answer or ''); "
    "local given = string.upper(ARGV[1]); "
    "if answer ~= '' and answer == given then redis.call('DEL', KEYS[1]); return raw end; "
    "return ''"
)


def _key(captcha_id: str) -> str:
    return f"ubsi:mira-captcha:{captcha_id}"


def _generate_svg(code: str) -> str:
    """SVG dengan huruf miring acak dan garis noise. Crisp di semua DPR."""
    import random

    rng = random.Random(secrets.randbits(64))
    width, height = 240, 64
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'<rect width="{width}" height="{height}" fill="#F0F7FB"/>',
    ]
    for _ in range(4):
        y = rng.randint(8, height - 8)
        x2 = rng.randint(width // 3, width)
        parts.append(
            f'<path d="M0 {y} Q {width // 2} {rng.randint(4, height - 4)} {x2} {rng.randint(8, height - 8)}" '
            f'stroke="#0369A1" stroke-opacity="0.35" stroke-width="1.5" fill="none"/>'
        )
    slot = (width - 40) / _CODE_LENGTH
    for idx, ch in enumerate(code):
        x = 20 + idx * slot + rng.randint(-2, 4)
        y = height - 18 + rng.randint(-4, 4)
        angle = rng.randint(-14, 14)
        fill = rng.choice(["#072033", "#0369A1", "#0F766E"])
        parts.append(
            f'<text x="{x:.0f}" y="{y}" font-family="DejaVu Sans Mono, monospace" font-size="34" '
            f'font-weight="bold" fill="{fill}" transform="rotate({angle} {x:.0f} {y})">{ch}</text>'
        )
    parts.append("</svg>")
    return "".join(parts)


async def create_challenge() -> dict:
    """Buat tantangan CAPTCHA Mira baru: {id, image, expires_in}."""
    code = "".join(secrets.choice(_CODE_CHARSET) for _ in range(_CODE_LENGTH))
    captcha_id = secrets.token_urlsafe(24)
    svg = _generate_svg(code)
    image = "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")
    redis = await cache.get_client()
    await redis.setex(_key(captcha_id), MIRA_CAPTCHA_TTL_SECONDS, json.dumps({"answer": code.upper()}))
    return {"id": captcha_id, "image": image, "expires_in": MIRA_CAPTCHA_TTL_SECONDS}


async def verify_challenge(captcha_id: str, code: str) -> bool:
    """Konsumsi hanya bila jawaban cocok (case-insensitive). Salah/hilang -> False."""
    if not captcha_id or not code:
        return False
    redis = await cache.get_client()
    result = await redis.eval(_VERIFY_LUA, 1, _key(captcha_id), code.strip().upper())
    if not isinstance(result, str) or not result:
        return False
    return True
