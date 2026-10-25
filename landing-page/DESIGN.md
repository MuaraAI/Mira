---
version: alpha
name: UBSI API Semi Pixel-Art (Muara AI sync)
description: Light estuary design system for the UBSI API landing page and dashboard. Riverbed ink on a clean mist canvas, river current blue accent, diffusion shadows, hydro-motion easing.

colors:
  primary: "#072033"
  secondary: "#3B5A70"
  background: "#F7FAFC"
  surface: "#FFFFFF"
  surface-alt: "#F0F7FB"
  stroke: "#D9E5ED"
  text: "#072033"
  text-muted: "#3B5A70"
  accent: "#0369A1"
  accent-hover: "#075985"
  on-accent: "#FFFFFF"
  accent-muted: "rgba(3, 105, 161, 0.12)"
  success: "#0F766E"
  warning: "#9A3412"
  danger: "#BE123C"
  code-bg: "#131b26"
  code-text: "#cdd6f4"
  code-accent: "#7DD3FC"

typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 3.5rem
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  h2:
    fontFamily: Space Grotesk
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  h3:
    fontFamily: Space Grotesk
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: Inter
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: Inter
    fontWeight: 500
    fontSize: 0.875rem
    lineHeight: 1.5
  code:
    fontFamily: JetBrains Mono
    fontWeight: 400
    lineHeight: 1.7

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 80px

rounded:
  all: 0px

pixel:
  frame: "2px stepped frame drawn with 4 hard box-shadows"
  line-strong: "#163A55"
  line-soft: "#CFE2EE"
  water: "#9CC6E0"
  water-mid: "#5FA3CC"
  tint: "#EAF3F9"
  highlight: "#DCEBF5"
  night: "#0B2D46"
  sun: "#FCD34D"

shadows:
  drop: "6px 6px 0 0 #CFE2EE (no blur)"
  drop-hover: "8px 8px 0 0 #0369A1 + translate(-2px, -2px)"

motion:
  easing: "cubic-bezier(0.16, 1, 0.3, 1)"
  duration: 300ms

---

# Mira: Design Specification (Semi Pixel-Art)

> Synced with the Muara AI web (muaraai.com, `src/app/globals.css`). The palette
> below is unchanged; the shape language is pixel art: square corners, 2px stepped
> frames (`.px-card`, `.px-frame`, `.px-chip`, `.px-icon`, `.px-btn`, `.px-btn-ghost`,
> `.px-input`), hard offset drops instead of blurred shadows, dashed `#CFE2EE`
> dividers, mono eyebrows with a square marker (`.section-kicker`), a stepped pixel
> shore above the footer, a tile-sweep mobile menu takeover, pixel scrollbars, and
> Pixelify Sans (OFL-1.1, self-hosted) for dashboard headings (`.portal-type`).
> Tailwind `rounded-*` tokens resolve to 0, `border` is 2px, and `shadow-*` tokens are
> hard drops, so existing pages inherit the theme. Sections below that mention radii,
> diffusion shadows, or hairlines describe the previous Fluid Currents version.

## Identity

Light-first design system for the Mira landing page (mira.muaraai.com) and
its authenticated dashboard, aligned with the Muara AI brand spec
"Fluid Currents Light v2" (DESIGNV2). The identity is the river mouth ("muara"):
clean estuary water, deep riverbed ink, and a single river current blue accent.
Solid white surfaces with hairline strokes and diffusion shadows. No dark canvas,
no neon glow, no glassmorphism (the navbar is the single semi-transparent exception).

## Hard Rules

1. **Light-only.** No dark mode, no dark canvases (code blocks are the one dark surface).
2. **The accent is text-safe.** `#0369A1` passes 4.5:1 on white and may be used
   for links, labels, and icons. Text on accent fills is always white (5.6:1).
3. **No neon.** No cyan glow, no pink/indigo ambient washes, no colored drop shadows.
   Elevation is the diffusion shadow only; hover lifts cards 2px, never color-shifts.
4. **Self-hosted fonts only**: Space Grotesk (400/500/700), Inter (400-700),
   JetBrains Mono (400/500/700) as local woff2. Zero CDN font requests.
5. **Zero emoji as UI icons**; zero em-dash in UI copy.

## Palette

| Token | Value | Role |
| --- | --- | --- |
| background | `#F7FAFC` | Page canvas (mist water) |
| surface | `#FFFFFF` | Cards, dialogs (crystal panel) |
| surface-alt | `#F0F7FB` | Secondary containers, chips, alert tints |
| stroke | `#D9E5ED` | Hairline borders and dividers |
| text / primary | `#072033` | Headlines, body, brand (15.5:1) |
| text-muted / secondary | `#3B5A70` | Secondary copy, metadata (6.6:1) |
| accent | `#0369A1` | Interactive: buttons, links, focus (5.6:1) |
| accent-hover | `#075985` | Hover state (6.8:1) |
| success | `#0F766E` | Positive status (4.9:1) |
| warning | `#9A3412` | Caution status (7.3:1) |
| danger | `#BE123C` | Destructive/error (5.9:1) |
| code-bg / code-text | `#131b26` / `#cdd6f4` | Code blocks (dark surface) |
| code-accent | `#7DD3FC` | Accent text inside dark code blocks (8.9:1) |

## Typography

Space Grotesk 700 for display (h1-h3, letter-spacing -0.03em), Inter for body and
controls, JetBrains Mono for code, API keys, and metrics. All self-hosted woff2
in `public/fonts/`, loaded via `next/font/local` with `display: swap`.

## Components

- **Navbar**: floating pill, `rgba(255,255,255,0.88)` + `blur(12px)`, stroke border,
  diffusion shadow. The only translucent surface in the system.
- **Cards**: solid `#FFFFFF`, 1px `#D9E5ED` stroke, radius 18px, diffusion shadow;
  hover = 2px lift + accent border at 30%.
- **Button primary**: solid ink `#072033`, white label, radius 10px; hover `#3B5A70`.
- **Button accent**: solid `#0369A1`, white label; hover `#075985`.
- **Badges/chips**: `#F0F7FB` fill, accent text, pill radius.
- **Alerts**: `#F0F7FB` fill, semantic status text (success/warning/danger), 30% border.
- **Code**: solid `#131b26`, `#cdd6f4` text, `#7DD3FC` for accent tokens.
- **Section divider**: thin asymmetric wave SVG, stroke `#D9E5ED` 1.5px, no fill.

## Motion

Single easing `cubic-bezier(0.16, 1, 0.3, 1)` everywhere, 300ms. Hover lifts are
2px (cards) / 1px (buttons). `prefers-reduced-motion` disables the loader spin and
all transitions. No parallax, no scroll-hijack, one orchestrated entrance per page.

## Accessibility

WCAG AAA target on primary text (15.5:1); every text/background pair in this spec
passes AA (4.5:1) minimum. Focus-visible: 2px `#0369A1` outline, 2px offset.
Touch targets >= 44x44px. Mobile floor 360px, no horizontal overflow.

## Voice & Tone

Technical, clean, developer-first. Indonesian for community content, English for
labels. No hype words, no decorative emoji, no em-dash in UI copy.

## Do's and Don'ts

### Do
- Keep the canvas clean: white cards on `#F7FAFC`, hairline strokes, lots of air.
- Use the accent for interaction only (buttons, links, focus, active states).
- Use surface-alt for grouping and status tints.

### Don't
- No dark canvases, neon glow, colored shadows, or glass blur on cards.
- No emoji as icons; no em-dash in UI copy.
- No third-party font CDNs.
