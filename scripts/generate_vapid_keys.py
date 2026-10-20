#!/usr/bin/env python3
"""Generate pasangan kunci VAPID untuk PWA Web Push.

Output siap ditempel ke .env:
  VAPID_PUBLIC_KEY=...
  VAPID_PRIVATE_KEY=...
Jalankan: .venv/bin/python scripts/generate_vapid_keys.py
"""
import sys

sys.path.insert(0, ".")

from app.pwa_webpush import generate_vapid_keypair  # noqa: E402


def main() -> None:
    priv_hex, pub_b64 = generate_vapid_keypair()
    print(f"VAPID_PUBLIC_KEY={pub_b64}")
    print(f"VAPID_PRIVATE_KEY={priv_hex}")


if __name__ == "__main__":
    main()
