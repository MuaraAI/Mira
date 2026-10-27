"use client";

import { ImagePlus, Moon, Sun } from "lucide-react";
import { useDialog } from "@/components/ConfirmDialog";
import { WALLPAPERS, useWallpaper, wallpaperStyle } from "@/lib/wallpaper";

/** Pilih wallpaper chat + atur kecerahannya, dengan pratinjau bubble supaya hasilnya langsung terlihat. */
export function WallpaperPicker() {
  const { notify } = useDialog();
  const wallpaper = useWallpaper();
  const { stored, brightness } = wallpaper;

  return (
    <div className="space-y-5">
      {/* Pratinjau */}
      <div className="h-40 overflow-hidden p-3 shadow-[0_0_0_2px_#CFE2EE]" style={wallpaper.style} aria-label="Pratinjau wallpaper">
        <div className="flex flex-col gap-2">
          <span className="max-w-[75%] self-start bg-white px-3 py-2 text-[13px] text-[#072033] shadow-[0_0_0_2px_#D9E5ED]">Halo, sudah lihat jadwal besok?</span>
          <span className="max-w-[75%] self-end bg-[#D7E9F5] px-3 py-2 text-[13px] text-[#072033] shadow-[0_0_0_2px_#9CC6E0]">Sudah, kelas jam 8 ya</span>
        </div>
      </div>

      {/* Kecerahan */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="wallpaper-brightness" className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3B5A70]">
            Kecerahan
          </label>
          <span className="font-mono text-xs font-semibold text-[#072033]">{brightness}%</span>
        </div>
        <div className="flex items-center gap-3">
          <Moon className="h-4 w-4 shrink-0 text-[#3B5A70]" aria-hidden="true" />
          <input
            id="wallpaper-brightness"
            type="range"
            min={0}
            max={100}
            step={1}
            value={brightness}
            onChange={(e) => wallpaper.setBrightness(Number(e.target.value))}
            className="h-2 w-full cursor-pointer accent-[#0369A1]"
          />
          <Sun className="h-4 w-4 shrink-0 text-[#A16207]" aria-hidden="true" />
        </div>
        <div className="mt-2 flex gap-2">
          {[
            { label: "Gelap", value: 25 },
            { label: "Asli", value: 50 },
            { label: "Terang", value: 75 },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => wallpaper.setBrightness(p.value)}
              aria-pressed={brightness === p.value}
              className={`min-h-9 flex-1 text-xs font-semibold transition-colors ${
                brightness === p.value ? "bg-[#0369A1] text-white" : "bg-[#F0F7FB] text-[#3B5A70] hover:bg-[#DCEBF5]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pilihan wallpaper */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#3B5A70]">Wallpaper</p>
        <div className="grid grid-cols-4 gap-2">
          {WALLPAPERS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => wallpaper.choose(w.id)}
              aria-pressed={stored.id === w.id}
              className={`flex aspect-[3/4] flex-col justify-end p-1 text-[11px] font-semibold text-[#072033] transition-shadow ${
                stored.id === w.id ? "shadow-[0_0_0_3px_#0369A1]" : "shadow-[0_0_0_2px_#CFE2EE] hover:shadow-[0_0_0_2px_#5FA3CC]"
              }`}
              style={wallpaperStyle({ id: w.id })}
            >
              <span className="bg-white/90 px-1 py-0.5">{w.label}</span>
            </button>
          ))}
          {wallpaper.hasCustomImage && (
            <button
              type="button"
              onClick={() => wallpaper.choose("custom")}
              aria-pressed={stored.id === "custom"}
              className={`flex aspect-[3/4] flex-col justify-end p-1 text-[11px] font-semibold text-[#072033] transition-shadow ${
                stored.id === "custom" ? "shadow-[0_0_0_3px_#0369A1]" : "shadow-[0_0_0_2px_#CFE2EE] hover:shadow-[0_0_0_2px_#5FA3CC]"
              }`}
              style={wallpaperStyle({ id: "custom", image: stored.image, brightness: 50 })}
            >
              <span className="bg-white/90 px-1 py-0.5">Fotoku</span>
            </button>
          )}
          <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 bg-[#F0F7FB] p-1 text-center text-[11px] font-semibold text-[#0369A1] shadow-[0_0_0_2px_#CFE2EE] transition-shadow hover:shadow-[0_0_0_2px_#5FA3CC]">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  await wallpaper.setCustom(file);
                } catch (err) {
                  notify(err instanceof Error ? err.message : "Gagal memasang wallpaper", "error");
                }
              }}
            />
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
            <span>{wallpaper.hasCustomImage ? "Ganti foto" : "Foto sendiri"}</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-[#3B5A70]">Tersimpan di perangkat ini.</p>
      </div>
    </div>
  );
}
