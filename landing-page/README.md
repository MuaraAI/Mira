# Mira: Web Landing Page & Dashboard

Official frontend client for Mira (`mira.muaraai.com`), built with Next.js 15, React 19, TypeScript, and Tailwind CSS.

## What It Is

A standalone Progressive Web App (PWA) and dashboard in the `/landing-page` subdirectory of the monorepo `MuaraAI/Mira`. It provides students with unified access to 6 campus services (SIAKAD, MyBest LMS, Ujian Online, Perpustakaan OPAC, Berita Resmi, and Repository Riset), personal API key management, and native Web Push notifications.

- **Design System**: Muara AI Semi Pixel-Art Light design tokens (canvas `#F7FAFC`, surface `#FFFFFF`, border `#CFE2EE`, text `#072033`, accent `#0369A1` WCAG AAA).
- **Typography**: Self-hosted Space Grotesk, Inter, and JetBrains Mono (`.woff2`) loaded via `next/font/local`. Zero external font CDN requests.
- **PWA Features**: Service Worker (`public/sw.js`) with RFC 8291 Web Push notifications (VAPID), offline fallback, and install prompts.
- **Performance**: SWR client-side RAM caching (0ms tab transitions), automatic background revalidation (60s), and silent re-authentication.

## Quick Start

### Prerequisites
- Node.js 18.18+ (tested on Node 22/26)
- npm 10+

### Installation & Development

```bash
cd landing-page
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build

```bash
npm run build
npm run start
```

## Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Required | Active Mira backend URL (e.g. `http://127.0.0.1:8300` or `https://api.muaraai.com/v1/mira`). |

## Deployment on Vercel

This application is configured for continuous deployment on Vercel:
- **Production Domain**: `mira.muaraai.com`
- **Redirect Domain**: `ubsi-api.muaraai.com` (HTTP 307 redirect to `mira.muaraai.com`)
- **Root Directory**: `landing-page`
- **Framework Preset**: Next.js

## Related Links

- [Root Repository](https://github.com/MuaraAI/Mira)
- [Design Specification](DESIGN.md)
- [API Documentation](https://api.muaraai.com/v1/mira/v1/docs)
- [License (MIT)](../LICENSE)
