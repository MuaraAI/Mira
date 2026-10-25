"""Mira Komunitas: chat ringan ala Discord (ruang + channel) dan Telegram (DM).

Lapisan:
- db.py      : skema SQLite + koneksi (tanpa logika bisnis)
- service.py : aturan akses, validasi, query (sinkron, dipanggil via threadpool)
- events.py  : fan-out realtime lewat Redis pub/sub (fail-open)
- router di app/modules/social.py hanya menerjemahkan HTTP <-> service
"""
