"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Wallpaper chat per perangkat (sinkron di HP & laptop lewat localStorage):
 * wallpaper Mira bawaan ringan (WebP responsif, background-size: cover),
 * pola minimalis CSS murni, atau foto sendiri.
 */
export interface WallpaperPreset {
  id: string;
  label: string;
  sublabel?: string;
  category: "mira" | "minimal";
  isPhoto?: boolean;
  style: React.CSSProperties;
}

export const DEFAULT_WALLPAPER_ID = "muara";

export const WALLPAPERS: WallpaperPreset[] = [
  {
    id: "muara",
    label: "Samudra Muara",
    sublabel: "Bawaan Mira",
    category: "mira",
    isPhoto: true,
    style: {
      backgroundColor: "#072033",
      backgroundImage: "url('/images/hero-ocean-muara.webp')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    },
  },
  {
    id: "chainsaw",
    label: "Chainsaw Dusk",
    sublabel: "Senja Tokyo",
    category: "mira",
    isPhoto: true,
    style: {
      backgroundColor: "#261B33",
      backgroundImage: "url('/wallpapers/chainsaw-dusk.webp')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    },
  },
  {
    id: "jujutsu",
    label: "Shibuya Night",
    sublabel: "Jujutsu Indigo",
    category: "mira",
    isPhoto: true,
    style: {
      backgroundColor: "#0D152B",
      backgroundImage: "url('/wallpapers/jujutsu-night.webp')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    },
  },
  {
    id: "frieren",
    label: "Meteor Night",
    sublabel: "Frieren Sky",
    category: "mira",
    isPhoto: true,
    style: {
      backgroundColor: "#0B1E36",
      backgroundImage: "url('/wallpapers/frieren-meteor.webp')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    },
  },
  {
    id: "shinkai",
    label: "Summer Sky",
    sublabel: "Awan Senja",
    category: "mira",
    isPhoto: true,
    style: {
      backgroundColor: "#489CD6",
      backgroundImage: "url('/wallpapers/shinkai-sky.webp')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    },
  },
  {
    id: "grid",
    label: "Titik",
    category: "minimal",
    style: {
      backgroundColor: "#F2F7FB",
      backgroundImage: "radial-gradient(#D5E4EF 1px, transparent 1px)",
      backgroundSize: "18px 18px",
    },
  },
  {
    id: "mint",
    label: "Mint",
    category: "minimal",
    style: {
      backgroundColor: "#EEF8F4",
      backgroundImage: "radial-gradient(#CDEBDF 1px, transparent 1px)",
      backgroundSize: "16px 16px",
    },
  },
  {
    id: "sand",
    label: "Pasir",
    category: "minimal",
    style: {
      backgroundColor: "#FBF7EF",
      backgroundImage: "radial-gradient(#EFE3CC 1px, transparent 1px)",
      backgroundSize: "16px 16px",
    },
  },
  {
    id: "plain",
    label: "Polos",
    category: "minimal",
    style: { backgroundColor: "#F5F9FC" },
  },
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

/** Default: foto sendiri dicerahkan agar bubble terbaca; wallpaper anime & minimal tampil seimbang. */
export function defaultBrightness(id: string) {
  if (id === "custom") return 70;
  const preset = WALLPAPERS.find((w) => w.id === id);
  if (preset?.isPhoto) return 52;
  return 50;
}

/** Lapisan warna sesuai kecerahan: di atas 50 makin terang, di bawah 50 makin gelap. */
function brightnessLayer(value: number): string | null {
  const v = Math.max(0, Math.min(100, value));
  if (v === 50) return null;
  const color =
    v > 50
      ? `rgba(247,250,252,${(((v - 50) / 50) * 0.88).toFixed(3)})`
      : `rgba(7,32,51,${(((50 - v) / 50) * 0.72).toFixed(3)})`;
  return `linear-gradient(${color}, ${color})`;
}

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {}
  return { id: DEFAULT_WALLPAPER_ID };
}

export function wallpaperStyle(stored: Stored): React.CSSProperties {
  const layer = brightnessLayer(stored.brightness ?? defaultBrightness(stored.id));
  if (stored.id === "custom" && stored.image) {
    return {
      backgroundColor: "#0B1E36",
      backgroundImage: [layer, `url(${stored.image})`].filter(Boolean).join(", "),
      backgroundSize: layer ? "100% 100%, cover" : "cover",
      backgroundPosition: layer ? "0 0, center" : "center",
      backgroundRepeat: "no-repeat",
    };
  }
  const presetObj =
    WALLPAPERS.find((w) => w.id === stored.id) ??
    WALLPAPERS.find((w) => w.id === DEFAULT_WALLPAPER_ID)!;
  const preset = presetObj.style;
  if (!layer) return preset;
  const image = preset.backgroundImage ? `${layer}, ${preset.backgroundImage}` : layer;
  const size = preset.backgroundSize ? `100% 100%, ${preset.backgroundSize}` : undefined;
  const position = preset.backgroundPosition ? `0 0, ${preset.backgroundPosition}` : undefined;
  return {
    ...preset,
    backgroundImage: image,
    ...(size ? { backgroundSize: size } : {}),
    ...(position ? { backgroundPosition: position } : {}),
  };
}

export function useWallpaper() {
  const [stored, setStored] = useState<Stored>({ id: DEFAULT_WALLPAPER_ID });

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
  const choose = useCallback(
    (id: string) => {
      const current = read();
      save({ id, image: current.image, brightness: defaultBrightness(id) });
    },
    [save]
  );

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
