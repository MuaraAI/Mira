import re

DISCORD_WEBHOOK_RE = re.compile(r"^https://(?:[a-z0-9-]+\.)?discord(?:app)?\.com/api/webhooks/\d{5,}/[\w-]{30,}$")
TELEGRAM_BOT_TOKEN_RE = re.compile(r"^\d{5,}:[A-Za-z0-9_-]{30,}$")
_CUSTOM_URL_RE = re.compile(r"^https://[^\s]+$")

ALLOWED_CATEGORIES = (
    "berita-kampus",
    "matkul-besok",
    "quiz-tugas",
    "tugas-baru",
    "pengumuman-siakad",
    "absen-kuliah",
    "nilai-keluar",
    "jadwal-ujian",
)


def validate_channel_payload(
    channel_type: str, categories: list[str], config: dict
) -> tuple[bool, str]:
    if channel_type not in ("discord", "telegram", "custom"):
        return False, "Tipe channel harus discord, telegram, atau custom"

    if not categories or not isinstance(categories, list):
        return False, "Minimal pilih satu kategori notifikasi"
    invalid = [c for c in categories if c not in ALLOWED_CATEGORIES]
    if invalid:
        return False, f"Kategori tidak dikenal: {', '.join(invalid)}"

    if channel_type == "discord":
        url = str(config.get("url", "")).strip()
        if not DISCORD_WEBHOOK_RE.match(url):
            return False, "Format Discord webhook URL tidak valid"
    elif channel_type == "telegram":
        token = str(config.get("bot_token", "")).strip()
        chat_id = str(config.get("chat_id", "")).strip()
        if not TELEGRAM_BOT_TOKEN_RE.match(token):
            return False, "Format Telegram bot token tidak valid"
        if not chat_id:
            return False, "Telegram chat ID wajib diisi"
    else:
        from app.modules.news import is_safe_webhook_url

        url = str(config.get("url", "")).strip()
        if not _CUSTOM_URL_RE.match(url) or not is_safe_webhook_url(url):
            return False, "Custom webhook URL harus URL https publik yang valid (anti-SSRF)"

    return True, ""
