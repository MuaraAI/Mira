"use client";

import { Check, ImagePlus, Moon, Sun } from "lucide-react";
import { useDialog } from "@/components/ConfirmDialog";
import { WALLPAPERS, useWallpaper, wallpaperStyle } from "@/lib/wallpaper";

/** Pilih wallpaper Mira atau pola minimalis + atur kecerahannya secara responsif di semua perangkat. */
export function WallpaperPicker() {
  const { notify } = useDialog();
  const wallpaper = useWallpaper();
  const { stored, brightness } = wallpaper;

  const miraWallpapers = WALLPAPERS.filter((w) => w.category === "mira");
  const minimalWallpapers = WALLPAPERS.filter((w) => w.category === "minimal");

  return (
    <div className="space-y-5">
      {/* Pratinjau langsung dengan bubble Telegram-style */}
      <div
        className="flex h-44 flex-col justify-center gap-2 overflow-hidden rounded-[12px] border-[1px] border-[#D9E5ED] p-3.5"
        style={wallpaper.style}
        aria-label="Pratinjau wallpaper"
      >
        <span className="max-w-[78%] self-start rounded-[14px] rounded-tl-[4px] border-[1px] border-[#DFECF4] bg-white px-3 py-2 text-[13px] text-[#072033] shadow-[0_1px_2px_rgba(7,32,51,0.08)]">
          Halo, sudah lihat jadwal besok?
        </span>
        <span className="max-w-[78%] self-end rounded-[14px] rounded-tr-[4px] border-[1px] border-[#C5E0F3] bg-[#E1F1FC] px-3 py-2 text-[13px] text-[#072033] shadow-[0_1px_2px_rgba(7,32,51,0.06)]">
          Sudah, kelas jam 8 pagi ya
        </span>
      </div>

      {/* Kecerahan */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="wallpaper-brightness"
            className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#3B5A70]"
          >
            Kecerahan
          </label>
          <span className="font-mono text-xs font-semibold tabular-nums text-[#072033]">
            {brightness}%
          </span>
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
        <div className="mt-2.5 grid grid-cols-3 gap-2">
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
              className={`min-h-[36px] rounded-[6px] border-[1px] text-xs font-medium transition-colors ${
                brightness === p.value
                  ? "border-[#072033] bg-[#072033] text-white"
                  : "border-[#D9E5ED] bg-white text-[#3B5A70] hover:border-[#0369A1] hover:text-[#072033]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Wallpaper Mira Bawaan */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#3B5A70]">
            Wallpaper Mira
          </p>
          <span className="text-[11px] text-[#648296]">Responsif HP &amp; Laptop</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {miraWallpapers.map((w) => {
            const active = stored.id === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => wallpaper.choose(w.id)}
                aria-pressed={active}
                className={`group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[10px] border-[2px] p-1.5 text-left transition-all ${
                  active
                    ? "border-[#0369A1] ring-2 ring-[#0369A1]/25"
                    : "border-[#D9E5ED] hover:border-[#5FA3CC]"
                }`}
                style={wallpaperStyle({ id: w.id, brightness: 50 })}
              >
                {active && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-[9999px] bg-[#0369A1] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
                <span
                  className="rounded-[6px] px-1.5 py-1 text-[10.5px] font-semibold leading-tight text-white"
                  style={{ backgroundColor: "rgba(7, 32, 51, 0.76)" }}
                >
                  <span className="block truncate">{w.label}</span>
                  {w.sublabel && (
                    <span className="block truncate text-[9.5px] font-normal text-[#BAE6FD]">
                      {w.sublabel}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pola Minimalis & Foto Sendiri */}
      <div>
        <p className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#3B5A70]">
          Minimalis &amp; Foto Sendiri
        </p>
        <div className="grid grid-cols-3 gap-2">
          {minimalWallpapers.map((w) => {
            const active = stored.id === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => wallpaper.choose(w.id)}
                aria-pressed={active}
                className={`relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-[10px] border-[2px] p-1.5 text-left transition-all ${
                  active
                    ? "border-[#0369A1] ring-2 ring-[#0369A1]/25"
                    : "border-[#D9E5ED] hover:border-[#5FA3CC]"
                }`}
                style={wallpaperStyle({ id: w.id, brightness: 50 })}
              >
                {active && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-[9999px] bg-[#0369A1] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
                <span className="rounded-[5px] bg-white/90 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#072033]">
                  {w.label}
                </span>
              </button>
            );
          })}

          {wallpaper.hasCustomImage && (
            <button
              type="button"
              onClick={() => wallpaper.choose("custom")}
              aria-pressed={stored.id === "custom"}
              className={`relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-[10px] border-[2px] p-1.5 text-left transition-all ${
                stored.id === "custom"
                  ? "border-[#0369A1] ring-2 ring-[#0369A1]/25"
                  : "border-[#D9E5ED] hover:border-[#5FA3CC]"
              }`}
              style={wallpaperStyle({ id: "custom", image: stored.image, brightness: 50 })}
            >
              <span className="rounded-[5px] bg-white/90 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#072033]">
                Fotoku
              </span>
            </button>
          )}

          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-[1px] border-dashed border-[#9CC6E0] bg-[#F5F9FC] p-1.5 text-center text-[11px] font-medium text-[#0369A1] transition-colors hover:border-[#0369A1] hover:bg-[#EAF3F9]">
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
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            <span>{wallpaper.hasCustomImage ? "Ganti foto" : "Foto sendiri"}</span>
          </label>
        </div>
        <p className="mt-2.5 text-[11.5px] text-[#648296]">
          Pengaturan otomatis menyesuaikan rasio layar HP, tablet, dan laptop.
        </p>
      </div>
    </div>
  );
}
