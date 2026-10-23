from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    HOST: str = "127.0.0.1"
    PORT: int = 8300
    REDIS_URL: str = "redis://127.0.0.1:6379/2"

    API_KEY: str = ""
    ALLOWED_ORIGINS: str = "https://mira.muaraai.com,https://ubsi-api.muaraai.com,http://localhost:3000"
    WEB_BASE_URL: str = "https://mira.muaraai.com"
    TRUSTED_PROXIES: str = "127.0.0.1"
    ROOT_PATH: str = ""

    # Session Login BSI (Redis-backed, sliding 7 hari)
    SESSION_COOKIE_DOMAIN: str = ""
    SQLITE_DB_PATH: str = "data/ubsi.db"
    # PWA Web Push (VAPID / RFC 8291-8292) — generate via scripts/generate_vapid_keys.py
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIM_EMAIL: str = "admin@muaraai.com"
    # Sesi SIAKAD/MyBest kedaluwarsa ~15 menit; diperbarui otomatis sebelum batas itu (detik)
    UPSTREAM_SESSION_MAX_AGE: int = 780

    # Scraper Proxy Configuration (Opsional - Single Proxy / Rotating Pool)
    SCRAPER_PROXY: str = ""
    SCRAPER_PROXY_POOL: str = ""

    TTL_DEFAULT: int = 60
    TTL_SCHEDULE: int = 7200
    TTL_GRADES: int = 1800
    TTL_ASSIGNMENTS: int = 600
    TTL_PRESENCE: int = 3
    TTL_NEWS: int = 900
    TTL_LIBRARY: int = 3600

    NEWS_WEBHOOK_URL: str = ""
    NEWS_WEBHOOK_INTERVAL: int = 600  # seconds (10 min)
    REALTIME_NOTIFY_INTERVAL: int = 60  # kelas segera mulai + pengingat absen (detik)
    DISCORD_WEBHOOK_URL: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
