# UBSI API: Web Landing Page & Dashboard

Official landing page and student dashboard for UBSI API (`ubsi-api.muaraai.com`), built with Next.js 15, React 19, and Tailwind CSS.

## What It Is

A standalone frontend client in the `/landing-page` subdirectory of the monorepo `MuaraAI/UBSI-API`. It presents the capabilities, architecture, interactive request examples, and contributor information for the UBSI API aggregator.

- **Theme**: Muara AI Deep Water design tokens (navy `#0A1220`, surface `#111C2E`, teal accent `#2DD4BF`).
- **Typography**: Self-hosted Space Grotesk, Inter, and JetBrains Mono (`.woff2`) loaded via `next/font/local`. Zero external font CDN requests.
- **Motion**: 3D CSS Pyramid Loader on the Hero section respecting `prefers-reduced-motion`.
- **Integrations**: Real-time GitHub stars & contributor commit counters, client-side health probe, dynamic Edge OpenGraph image generation (`@vercel/og`), and Schema.org JSON-LD structured data.

## Quick Start

### Prerequisites
- Node.js 18.18+ (tested on Node 26)
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
| `NEXT_PUBLIC_API_URL` | Required | Active UBSI API backend URL (e.g. `http://127.0.0.1:8300` or `https://api.muaraai.com/v1/ubsi-api`). Required for dashboard and login operations. |
| `UBSI_BACKEND_URL` | Optional | Server-side backend URL for the `/recap` proxy page. Defaults to root `.env` or local port 8300. |
| `UBSI_API_KEY` | Optional | Master API key used by the `/recap` server-side proxy route. |

## Deployment on Vercel

This application is designed for native deployment on Vercel:

1. Import the `MuaraAI/UBSI-API` repository into Vercel.
2. Set **Root Directory** to `landing-page`.
3. Framework preset will automatically detect **Next.js**.
4. Set `NEXT_PUBLIC_API_URL` in the project Environment Variables dashboard (e.g. `https://api.muaraai.com/v1/ubsi-api`).
5. Deploy.

## Design Reference

Design tokens, color contrast proofs, spacing scales, and accessibility rules are specified in [DESIGN.md](DESIGN.md).

## Related Links

- [Backend API Repository](https://github.com/MuaraAI/UBSI-API)
- [API Documentation](https://ubsi-api.muaraai.com/docs)
- [License (MIT)](../LICENSE)
