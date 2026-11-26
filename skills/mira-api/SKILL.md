---
name: mira-api
description: Use when integrating the Mira REST API (UBSI API), building student bots or scripts, parsing Mira JSON envelopes, or troubleshooting Mira API error codes.
license: MIT
---

# Mira REST API Integration (`UBSI API`)

Gateway HTTP REST untuk mengintegrasikan data akademik 6 layanan kampus UBSI ke bot Discord/Telegram, skrip otomasi, atau aplikasi kustom.

## Base URL & Dokumentasi

- **Production Gateway:** `https://api.muaraai.com/v1/mira`
- **HTML Developer Docs:** `https://mira.muaraai.com/developers`
- **JSON Endpoint Catalog:** `https://api.muaraai.com/v1/mira/v1/docs`
- **Local Dev / VPS:** `http://127.0.0.1:8300` (Swagger UI di `/docs`)

## Autentikasi & Rate Limit

| Mode | Header | Batas Laju |
|---|---|---|
| **Cloud Hosted (`api.muaraai.com`)** | `Authorization: Bearer muara_mira_YOUR_KEY` (atau token sesi `ubsi_session`) | **60 req/menit** per klien; login `10/menit` per IP & `5/menit` per NIM |
| **Self-Host (Master Key)** | `X-API-Key: <MASTER_KEY>` + header opsional `X-Elearning-NIM/Pass`, `X-Studentv2-NIM/Pass` | Unlimited untuk Master Key |

## Contoh Pemanggilan

```bash
curl -s "https://api.muaraai.com/v1/mira/v1/elearning/courses" \
  -H "Authorization: Bearer muara_mira_YOUR_KEY"
```

## Format JSON Envelope

Respons sukses (`200 OK`):
```json
{
  "success": true,
  "data": [...],
  "cached": false
}
```
Saat server kampus down/sibuk, cache Last-Known-Good (SWR) mengembalikan data terakhir dengan `"stale": true, "cached": true`.

Respons error (`4xx`/`5xx`):
```json
{
  "success": false,
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "Deskripsi kesalahan teknis",
    "module": "elibrary"
  }
}
```

## Kode Galat & Cara Menanganinya

| HTTP / Code | Penyebab | Penanganan di Klien |
|---|---|---|
| `400 CONFIG_MISSING` | Mode self-host memanggil endpoint privat tanpa kredensial `.env` | Isi kredensial atau pakai endpoint publik (`/v1/news`, `/v1/elibrary`, `/v1/repository`, `/v1/academic/events`) |
| `401 UNAUTHORIZED` | Bearer key/token salah atau kedaluwarsa | Perbarui Personal API Key di `/dashboard/keys` atau login ulang |
| `409 SIAKAD_RELINK_REQUIRED` | Password SIAKAD belum ditautkan atau ditolak kampus | Arahkan user menautkan ulang di `/dashboard/sesi` (`POST /v1/auth/credentials`) |
| `429 RATE_LIMITED` / `IP_BLACKLISTED` | Melebihi 60 req/menit atau spam `/v1/auth/login` | Baca header `Retry-After` atau `error.retry_after`, hentikan retry sementara |
| `502 UPSTREAM_ERROR` | Server kampus down & belum ada cache LGG | Lakukan exponential backoff, jangan bombardir server kampus |
| `503 MAINTENANCE` | Saklar maintenance aktif | Tampilkan status maintenance tanpa mengulang request |

## Kesalahan Umum yang Harus Dihindari

- Jangan meneruskan token/password kampus di query URL atau log aplikasi.
- Jangan memanggil endpoint mutasi (`POST /v1/elearning/presence`, `submit`, `answer`) dalam cron tanpa izin pengguna.
- Jangan mengulang request saat `429` sebelum `Retry-After` habis.

## Referensi Lengkap

Baca [references/endpoints.md](references/endpoints.md) untuk daftar lengkap endpoint REST API seluruh modul.
