"use client";

import type { ReactionKey } from "@/lib/social";

/**
 * Reaksi memakai Fluent Emoji 3D (Microsoft, MIT, lihat public/emoji/LICENSE-fluentui-emoji.txt):
 * emoji asli dengan gaya 3D yang beda dari emoji bawaan WhatsApp/OS. Aset di-self-host sebagai
 * WebP 72px (maks ~4 KB) dan hanya dimuat saat tampil.
 */
export const REACTIONS: { key: ReactionKey; label: string }[] = [
  { key: "heart", label: "Suka" },
  { key: "haha", label: "Ngakak" },
  { key: "fire", label: "Mantap" },
  { key: "up", label: "Setuju" },
  { key: "wow", label: "Wow" },
  { key: "sad", label: "Sedih" },
  { key: "pray", label: "Makasih" },
  { key: "clap", label: "Tepuk tangan" },
  { key: "party", label: "Selamat" },
  { key: "hundred", label: "Seratus" },
  { key: "eyes", label: "Lihat" },
  { key: "skull", label: "Mati ketawa" },
  { key: "think", label: "Mikir" },
  { key: "love", label: "Sayang" },
  { key: "cool", label: "Keren" },
  { key: "salute", label: "Siap" },
  { key: "rocket", label: "Gas" },
  { key: "check", label: "Beres" },
  { key: "rofl", label: "Guling-guling" },
  { key: "sob", label: "Nangis" },
  { key: "melt", label: "Meleleh" },
  { key: "sparkles", label: "Kinclong" },
];

/** Enam reaksi cepat di bar atas menu pesan; sisanya ada di panel lengkap. */
export const QUICK_REACTIONS: ReactionKey[] = ["heart", "haha", "fire", "up", "wow", "pray"];

export const REACTION_LABEL = Object.fromEntries(REACTIONS.map((r) => [r.key, r.label])) as Record<ReactionKey, string>;

export function Emoji({ name, size = 20, className = "" }: { name: ReactionKey; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/emoji/${name}.webp`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`pointer-events-none select-none ${className}`}
    />
  );
}
