"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Wallpaper chat per perangkat (seperti Telegram): preset CSS murni (0 byte unduhan)
 * atau gambar sendiri yang dikecilkan ke WebP lalu disimpan di localStorage.
 */
export interface WallpaperPreset {
  id: string;
  label: string;
  style: React.CSSProperties;
}

const PIXEL_WAVE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='16' shape-rendering='crispEdges'%3E%3Cpath fill='%23D3E6F2' d='M0 10h4v2H0zM4 8h4v2H4zM8 6h8v2H8zM16 8h4v2h-4zM20 10h8v2h-8zM28 8h4v2h-4z'/%3E%3C/svg%3E\")";
const PIXEL_STARS =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' shape-rendering='crispEdges'%3E%3Cg fill='%23CFE2EE'%3E%3Cpath d='M6 6h2v2H6zM30 14h2v2h-2zM18 30h2v2h-2zM40 38h2v2h-2zM12 40h2v2h-2z'/%3E%3Cpath d='M38 4h2v6h-2zM36 6h6v2h-6z'/%3E%3C/g%3E%3C/svg%3E\")";

export const WALLPAPERS: WallpaperPreset[] = [
  { id: "grid", label: "Titik", style: { backgroundColor: "#F5F9FC", backgroundImage: "radial-gradient(#DCE8F0 1px, transparent 1px)", backgroundSize: "18px 18px" } },
  { id: "wave", label: "Ombak", style: { backgroundColor: "#F2F8FC", backgroundImage: PIXEL_WAVE, backgroundSize: "32px 16px" } },
  { id: "stars", label: "Bintang", style: { backgroundColor: "#F4F8FB", backgroundImage: PIXEL_STARS, backgroundSize: "48px 48px" } },
  {
    id: "check",
    label: "Kotak",
    style: {
      backgroundColor: "#F7FAFC",
      backgroundImage: "linear-gradient(45deg, #EEF4F8 25%, transparent 25%, transparent 75%, #EEF4F8 75%), linear-gradient(45deg, #EEF4F8 25%, transparent 25%, transparent 75%, #EEF4F8 75%)",
      backgroundSize: "24px 24px",
      backgroundPosition: "0 0, 12px 12px",
    },
  },
  { id: "mint", label: "Mint", style: { backgroundColor: "#EEF8F4", backgroundImage: "radial-gradient(#CDEBDF 1px, transparent 1px)", backgroundSize: "16px 16px" } },
  { id: "sand", label: "Pasir", style: { backgroundColor: "#FBF7EF", backgroundImage: "radial-gradient(#EFE3CC 1px, transparent 1px)", backgroundSize: "16px 16px" } },
  { id: "plain", label: "Polos", style: { backgroundColor: "#F7FAFC" } },
];

const KEY = "mira_chat_wallpaper";
const EVENT = "mira-wallpaper-change";

interface Stored {
  id: string;
  /** data URL WebP untuk id "custom". */
  image?: string;
  /** 0 = paling gelap, 50 = asli, 100 = paling terang. */
  brightness?: number;
}

/** Default: foto sendiri sedikit dicerahkan supaya bubble tetap terbaca; preset tampil apa adanya. */
export function defaultBrightness(id: string) {
  return id === "custom" ? 72 : 50;
}

/** Lapisan warna sesuai kecerahan: di atas 50 makin putih, di bawah 50 makin gelap. */
function brightnessLayer(value: number): string | null {
  const v = Math.max(0, Math.min(100, value));
  if (v === 50) return null;
  const color = v > 50 ? `rgba(247,250,252,${(((v - 50) / 50) * 0.9).toFixed(3)})` : `rgba(7,32,51,${(((50 - v) / 50) * 0.75).toFixed(3)})`;
  return `linear-gradient(${color}, ${color})`;
}

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {}
  return { id: "grid" };
}

export function wallpaperStyle(stored: Stored): React.CSSProperties {
  const layer = brightnessLayer(stored.brightness ?? defaultBrightness(stored.id));
  if (stored.id === "custom" && stored.image) {
    return {
      backgroundColor: "#F7FAFC",
      backgroundImage: [layer, `url(${stored.image})`].filter(Boolean).join(", "),
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  const preset = (WALLPAPERS.find((w) => w.id === stored.id) ?? WALLPAPERS[0]).style;
  if (!layer) return preset;
  // Preset: lapisan kecerahan di atas pola, ukuran lapisan mengikuti layar penuh.
  const image = preset.backgroundImage ? `${layer}, ${preset.backgroundImage}` : layer;
  const size = preset.backgroundSize ? `100% 100%, ${preset.backgroundSize}` : undefined;
  const position = preset.backgroundPosition ? `0 0, ${preset.backgroundPosition}` : undefined;
  return { ...preset, backgroundImage: image, ...(size ? { backgroundSize: size } : {}), ...(position ? { backgroundPosition: position } : {}) };
}

export function useWallpaper() {
  const [stored, setStored] = useState<Stored>({ id: "grid" });

  useEffect(() => {
    setStored(read());
    const sync = () => setStored(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((next: Stored) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      throw new Error("Penyimpanan browser penuh. Coba gambar yang lebih kecil.");
    }
    setStored(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const setCustom = useCallback(
    async (file: File) => {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const image = canvas.toDataURL("image/webp", 0.72);
      if (image.length > 900_000) throw new Error("Gambar terlalu besar, pilih yang lebih sederhana");
      save({ id: "custom", image, brightness: defaultBrightness("custom") });
    },
    [save]
  );

  const setBrightness = useCallback((brightness: number) => save({ ...read(), brightness }), [save]);
  const choose = useCallback((id: string) => {
    const current = read();
    // Ganti antar preset tetap menyimpan foto sendiri supaya bisa dipilih lagi tanpa upload ulang.
    save({ id, image: id === "custom" ? current.image : current.image, brightness: defaultBrightness(id) });
  }, [save]);

  return {
    stored,
    style: wallpaperStyle(stored),
    brightness: stored.brightness ?? defaultBrightness(stored.id),
    hasCustomImage: Boolean(stored.image),
    choose,
    setCustom,
    setBrightness,
  };
}
