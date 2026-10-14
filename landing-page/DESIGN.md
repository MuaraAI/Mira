---
version: alpha
name: UBSI API Light Glass Ocean
description: Light glassmorphism system for the UBSI API landing page. Ocean Cyan accent on a mist canvas, Gordita typography, WCAG AA verified.

colors:
  primary: "#062535"
  secondary: "#5a616e"
  background: "#eef1f6"
  surface: "rgba(255, 255, 255, 0.60)"
  surface-solid: "#ffffff"
  surface-hover: "rgba(255, 255, 255, 0.80)"
  stroke: "rgba(17, 24, 39, 0.08)"
  text: "#1a1d26"
  text-muted: "#5a616e"
  accent: "#92EEFF"
  accent-hover: "#B8F5FF"
  on-accent: "#062535"
  accent-muted: "rgba(146, 238, 255, 0.15)"
  accent-glow: "rgba(146, 238, 255, 0.40)"
  code-bg: "#131b26"
  code-text: "#cdd6f4"

typography:
  body:
    fontFamily: Gordita
    fontWeight: 400
    lineHeight: 1.6
  h1:
    fontFamily: Gordita
    fontWeight: 900
    lineHeight: 1.1
  h2:
    fontFamily: Gordita
    fontWeight: 700
    lineHeight: 1.2
  code:
    fontFamily: JetBrains Mono
    fontWeight: 400
    lineHeight: 1.7

spacing:
  base: 4px
  card-padding: 28px
  section-gap: 80px

rounded:
  small: 12px
  card: 18px
  large: 26px
  pill: 100px
---

# UBSI API — Design Specification (Glassmorphism v2)

## Identity

Light glassmorphism design system for the UBSI API landing page (ubsi-api.muaraai.com).
White-dominant frosted surfaces over a soft blue-gray canvas with ambient color washes.
The accent is **Ocean Cyan**: a pale, high-luminance cyan that reads as clear tropical
water over the light theme. The site is light-mode only by design; the ocean identity
comes from the cyan accent family, not from a dark canvas.

## Hard Rules (accent discipline)

1. **The accent is decoration, never text.** `--accent` (`#92EEFF`) MUST NOT be used
   as a text color on any light background (contrast 1.17:1, hard fail). Its roles:
   fills, borders, glows, focus rings, decorative gradients.
2. **Text on accent fill is always `--on-accent`** (`#062535`, 12.01:1). White text
   on the accent is forbidden (1.32:1).
3. Every glass component carries the white hairline edge and the shared easing.
   No drop shadows outside the documented glass shadow tokens.

## Palette

| Token | Value | Role |
| --- | --- | --- |
| background | `#eef1f6` | Page canvas |
| surface | `rgba(255,255,255,0.60)` | Glass fill |
| surface-solid | `#ffffff` | Opaque fallback |
| stroke | `rgba(17,24,39,0.08)` | Glass border |
| text | `#1a1d26` | Primary text |
| text-muted | `#5a616e` | Secondary text |
| accent | `#92EEFF` | Ocean Cyan: fills, borders, glow, focus |
| accent-hover | `#B8F5FF` | Hover state of accent fills |
| on-accent | `#062535` | The ONLY text color on accent fills |
| accent-muted | `rgba(146,238,255,0.15)` | Tinted badges, washes |
| accent-glow | `rgba(146,238,255,0.40)` | Hover glow |
| code-bg / code-text | `#131b26` / `#cdd6f4` | Code blocks |

Ambient washes (background only, never components): teal `#2DD4BF` 15%, indigo
`#818cf8` 10%, pink `#f472b6` 8%; grid overlay 1px at 3%.

## Glass System

| Property | Value |
| --- | --- |
| Glass fill | `linear-gradient(150deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.50) 45%, rgba(255,255,255,0.32) 100%)` |
| 3D glass fill | `linear-gradient(145deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0.25) 100%)` |
| Backdrop | `blur(24px) saturate(190%)` |
| Edge | white hairline top + faint cyan inset bottom |

## Typography

Gordita for everything textual (400/500 body, 700/900 display), JetBrains Mono for
code and metadata, Inter as system fallback. Self-hosted woff2 only; zero external
font requests. Line lengths stay under 80 characters, display line-height >= 1.1.

## Components

- Navbar: floating glass pill, radius 100px, max-w-5xl centered.
- Cards: glass fill + stroke + backdrop blur, radius 18px, padding 24-32px.
- Badges: accent-muted fill, on-accent text, pill.
- Buttons: primary = solid accent with on-accent label; secondary = glass fill.
- Code: solid `#131b26` block, `#cdd6f4` text, radius 12px.

## Motion

Single easing `cubic-bezier(0.22, 1, 0.36, 1)` everywhere. Hover lift on 3D cards
only (translate + faint cyan glow). `prefers-reduced-motion` disables all loops.
No parallax, no scroll-hijack, one orchestrated entrance per page.

## Accessibility

All primary pairs verified AA (see front-matter contrast block): body text 14.87:1,
muted 5.50:1, on-accent 12.01:1, code 11.98:1. Focus = 2px accent outline, 2px offset.
Touch targets >= 44x44px. Mobile floor 360px, no horizontal overflow.

## Voice & Tone

Technical, clean, developer-first. Indonesian for community content, English for
labels. No hype words, no decorative emoji, no em-dash in UI copy. The API speaks
for itself.
