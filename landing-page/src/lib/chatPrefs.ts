"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Preferensi chat per perangkat: ukuran teks bubble dan daftar percakapan yang dibisukan.
 * Bisukan berefek nyata: badge belum dibaca jadi abu-abu dan tidak dihitung di total rail.
 */
export type ChatFontSize = "sm" | "md" | "lg";

export const FONT_SIZES: Record<ChatFontSize, { label: string; px: number }> = {
  sm: { label: "Kecil", px: 14 },
  md: { label: "Sedang", px: 15 },
  lg: { label: "Besar", px: 17 },
};

interface Prefs {
  fontSize: ChatFontSize;
  muted: number[];
}

const KEY = "mira_chat_prefs";
const EVENT = "mira-chat-prefs-change";
const DEFAULTS: Prefs = { fontSize: "md", muted: [] };

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Prefs>;
      return {
        fontSize: parsed.fontSize && parsed.fontSize in FONT_SIZES ? parsed.fontSize : "md",
        muted: Array.isArray(parsed.muted) ? parsed.muted.filter((n) => typeof n === "number") : [],
      };
    }
  } catch {}
  return DEFAULTS;
}

export function useChatPrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    setPrefs(read());
    const sync = () => setPrefs(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((next: Prefs) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    setPrefs(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return {
    fontSize: prefs.fontSize,
    fontPx: FONT_SIZES[prefs.fontSize].px,
    isMuted: (id: number) => prefs.muted.includes(id),
    setFontSize: (fontSize: ChatFontSize) => save({ ...read(), fontSize }),
    toggleMute: (id: number) => {
      const current = read();
      const muted = current.muted.includes(id) ? current.muted.filter((m) => m !== id) : [...current.muted, id];
      save({ ...current, muted });
    },
  };
}
