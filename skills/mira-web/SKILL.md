---
name: mira-web
description: Use when building or editing Mira Next.js 15 routes, React UI components, dashboard auth flows, SEO metadata or JSON-LD, self-hosted fonts, or PWA assets in landing-page.
license: MIT
---

# Mira Frontend & SEO Standards (`landing-page/`)

Panduan pengembangan antarmuka Next.js 15 App Router, token desain **Semi Pixel-Art Light / Estuary**, kontrak auth, performa font, dan standar SEO pada `landing-page/`.

## Desain, Anti-Slop & Aksesibilitas

1. **Token Desain Resmi:** Ikuti `landing-page/DESIGN.md` — kanvas terang `#F7FAFC`, tinta utama `#072033`, aksen biru arus `#0369A1`.
2. **Zero Em-Dash:** Dilarang memakai karakter em-dash (`—`) pada copy UI, metadata, atau dokumen publik web; gunakan titik dua (`:`) atau titik (`.`).
3. **Zero Decorative Emojis:** Gunakan ikon SVG (`lucide-react`) atau Material glyphs, bukan emoji UI.
4. **Font Self-Hosted `.woff2` Saja:** Dilarang memuat CDN Google Fonts atau file `.otf` trial.
   - Root `landing-page/src/app/layout.tsx`: hanya `SpaceGrotesk` (`preload: true`), `Inter` (`preload: false`), dan `JetBrainsMono` (`preload: false`) agar initial preload `<= 3` file.
   - `Pixelify Sans`: dimuat hanya di `landing-page/src/app/dashboard/layout.tsx` (`preload: false`).
5. **Mobile Floor `360px` & WCAG AAA:** Semua layout wajib bebas overflow horizontal (`scrollWidth <= clientWidth` pada lebar `360px`; gunakan `min-w-0` + `overflow-x-auto` untuk blok kode/tabel), pertahankan skip-link `#main-content`, rasio kontras utama >= 7:1, dan penutup drawer keyboard `Escape`.

## Kontrak Auth & Sesi Dashboard

- **Jangan ubah bentuk `systems` pada `GET /v1/auth/me`:** `useRequireSession`, `ChangePasswordCard`, `AuthPortal`, dan `lib/security.ts` bergantung pada properti boolean `systems` (`siakad`, `mybest`) dan `links`.
- **Single Sliding Expiry:** Sesi dashboard berdurasi 7 hari sliding di Redis — jangan menambah countdown/expiry sekunder di sisi klien.
- **Login SSR & Tanpa CAPTCHA:** Form login tidak menampilkan CAPTCHA (diselesaikan server). `/login` wajib merender `<h1>` dan form pada SSR agar terindeks bersih dan ramah non-JS client; redirect sesi aktif berjalan di sisi klien.

## Kontrak SEO, Metadata & Aset Publik

- **Gunakan Helper Terpusat (`src/lib/site.ts`):** Semua halaman publik wajib memakai `buildPageMetadata({ title, description, path })` dan `buildBreadcrumbJsonLd(...)` agar `alternates.canonical`, `openGraph.*`, dan `twitter.*` unik per rute.
- **Canonical Root Terisolasi:** `alternates: { canonical: "/" }` hanya diletakkan di `src/app/page.tsx` — jangan di root `layout.tsx` agar tidak bocor ke `/dashboard` dan `404`.
- **Schema JSON-LD Valid:** Pakai `"@type": "WebApplication"` dengan `"applicationCategory": "EducationalApplication"` (jangan taruh `"EducationalApplication"` di array `@type`).
- **Crawlability & Sitemap:** Pertahankan `Disallow: ["/dashboard", "/api/"]` di `robots.ts`, header `X-Robots-Tag: noindex, nofollow, noarchive` untuk `/dashboard` & `/dashboard/:path*` di `next.config.ts`, serta tanggal `lastModified` statis di `sitemap.ts`. Tambahkan rute publik baru ke `sitemap.ts` dan `public/llms.txt`.
- **Kebersihan `public/`:** Jangan simpan aset mentah ukuran besar (`.jpeg`/`.png` raw mentah) di folder `public/`.

## Gerbang Verifikasi Wajib

```bash
grep -rn "—" landing-page/src/ landing-page/public/llms.txt || true
cd landing-page && ./node_modules/.bin/tsc --noEmit && npm run build
```
