"use client";

import type { ReactionKey } from "@/lib/social";

/**
 * Reaksi memakai emoji warna modern resolusi penuh (Apple / Segoe UI / Noto Color Emoji):
 * tajam di layar Retina maupun HP kentang, 0 byte unduhan ekstra, dan tidak buram.
 */
export const REACTIONS: { key: ReactionKey; label: string; glyph: string }[] = [
  { key: "heart", label: "Suka", glyph: "❤️" },
  { key: "haha", label: "Ngakak", glyph: "😂" },
  { key: "fire", label: "Mantap", glyph: "🔥" },
  { key: "up", label: "Setuju", glyph: "👍" },
  { key: "wow", label: "Wow", glyph: "😮" },
  { key: "sad", label: "Sedih", glyph: "😢" },
  { key: "pray", label: "Makasih", glyph: "🙏" },
  { key: "clap", label: "Tepuk tangan", glyph: "👏" },
  { key: "party", label: "Selamat", glyph: "🎉" },
  { key: "hundred", label: "Seratus", glyph: "💯" },
  { key: "eyes", label: "Lihat", glyph: "👀" },
  { key: "skull", label: "Mati ketawa", glyph: "💀" },
  { key: "think", label: "Mikir", glyph: "🤔" },
  { key: "love", label: "Sayang", glyph: "😍" },
  { key: "cool", label: "Keren", glyph: "😎" },
  { key: "salute", label: "Siap", glyph: "🫡" },
  { key: "rocket", label: "Gas", glyph: "🚀" },
  { key: "check", label: "Beres", glyph: "✅" },
  { key: "rofl", label: "Guling-guling", glyph: "🤣" },
  { key: "sob", label: "Nangis", glyph: "😭" },
  { key: "melt", label: "Meleleh", glyph: "🫠" },
  { key: "sparkles", label: "Kinclong", glyph: "✨" },
];

/** Enam reaksi cepat di bar atas menu pesan; sisanya ada di panel lengkap. */
export const QUICK_REACTIONS: ReactionKey[] = ["heart", "haha", "fire", "up", "wow", "pray"];

export const REACTION_LABEL = Object.fromEntries(
  REACTIONS.map((r) => [r.key, r.label])
) as Record<ReactionKey, string>;

const REACTION_GLYPH = Object.fromEntries(
  REACTIONS.map((r) => [r.key, r.glyph])
) as Record<ReactionKey, string>;

export function Emoji({
  name,
  size = 20,
  className = "",
}: {
  name: ReactionKey;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-flex shrink-0 select-none items-center justify-center leading-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.88),
        fontFamily:
          '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif',
      }}
    >
      {REACTION_GLYPH[name] ?? "✨"}
    </span>
  );
}
