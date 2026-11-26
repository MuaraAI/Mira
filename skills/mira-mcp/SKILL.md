---
name: mira-mcp
description: Use when connecting an AI agent to the Mira MCP server or calling mira_* academic tools for UBSI MyBest, SIAKAD, exams, library, repository, or reminders.
license: MIT
---

# Mira MCP Server (`mira_*`)

Server Model Context Protocol (MCP) Mira menyediakan **42 tools akademik** terisolasi per mahasiswa melalui namespace tunggal `mira_*` (transport Streamable HTTP; alias lama `ubsi_*` sudah dihapus).

## Endpoint & Autentikasi

- **Production MCP URL:** `https://api.muaraai.com/v1/mira/mcp` (lokal VPS: `http://127.0.0.1:8350/mcp`)
- **Header Wajib:** `Authorization: Bearer muara_mira_YOUR_KEY` (kunci legacy `muara_ubsi_*` tetap didukung)
- **Cara Mendapat Key:** Login di `https://mira.muaraai.com/login` -> buka `/dashboard/keys` -> **Buat API Key Baru** (maks 5 key aktif per akun). Password kampus tetap terenkripsi di server dan tidak pernah diekspos ke model AI.

## Aturan Wajib Pemanggilan Tools

1. **Selalu mulai dari `mira_get_courses` untuk fitur MyBest:** modul tugas, presensi, materi, dan forum diskusi memakai token Laravel terenkripsi (`eyJ...`: `token_absen`, `token_assignment`, `token_diskusi`, `token_learning`). Ambil token dari `mira_get_courses` sebelum memanggil tool turunan.
2. **SIAKAD bersifat opsional:** 12 tool `mira_*` SIAKAD (seperti `mira_get_profile`, `mira_get_khs`, `mira_get_krs`) hanya aktif bila pengguna sudah menautkan akun `students.bsi.ac.id` di menu **Sesi & Keamanan**.
3. **Gerbang Keamanan `[WRITE]` (WAJIB):** Jangan pernah memanggil tool mutasi berikut tanpa persetujuan eksplisit mahasiswa pada percakapan berjalan:
   - `mira_submit_presence`
   - `mira_submit_assignment` & `mira_upload_assignment`
   - `mira_submit_quiz_answer`
   - `mira_submit_discussion_comment` & `mira_create_discussion`
   - `mira_submit_teaching_feedback`

## Penanganan Galat Umum

| Kode Error | Arti | Tindakan |
|---|---|---|
| `UNAUTHORIZED` | Header Bearer kosong atau API Key tidak valid / dicabut | Minta user buat ulang key di `/dashboard/keys` |
| `SESSION_EXPIRED` | Sesi kampus/dashboard berakhir | Minta user login ulang di `https://mira.muaraai.com/login` |
| `SIAKAD_RELINK_REQUIRED` | Password SIAKAD belum ditautkan atau ditolak kampus | Arahkan user menautkan ulang SIAKAD di `/dashboard/sesi` |
| `UPSTREAM_TIMEOUT` | Server kampus sibuk/down | Jika `"stale": true` tersedia, sampaikan data dari cache fallback |

## Referensi Lengkap

Baca [references/tools.md](references/tools.md) untuk daftar lengkap 42 tools `mira_*` beserta parameter dan snippet konfigurasi **Claude Code**, **Cursor**, **Codex CLI**, **Hermes Agent**, serta **Claude Desktop**.
