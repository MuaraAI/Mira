"use client";

import { ChevronDown } from "lucide-react";

export interface CourseOption {
  key: string;
  label: string;
  /** Teks kecil di bawah label, contoh "Selasa 07:30-10:00". */
  sub?: string;
  /** Penanda singkat, contoh "Hari Ini". */
  badge?: string;
}

/**
 * Pemilih mata kuliah: dropdown satu baris di HP (tidak perlu geser ke samping),
 * chip yang membungkus ke baris baru di tablet/desktop.
 */
export function CourseSelect({
  options,
  value,
  onChange,
  label = "Mata kuliah",
}: {
  options: CourseOption[];
  value: string | null;
  onChange: (key: string) => void;
  label?: string;
}) {
  const current = options.find((o) => o.key === value) ?? options[0];

  return (
    <div>
      {/* HP: native select dibungkus tampilan pixel, jadi tetap nyaman dipakai dengan jempol. */}
      <label className="relative block md:hidden">
        <span className="sr-only">{label}</span>
        <span className="px-input flex min-h-14 items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-secondary">{label}</span>
            <span className="block truncate text-sm font-bold text-foreground">{current?.label ?? "-"}</span>
          </span>
          {current?.badge && (
            <span className="shrink-0 bg-[#0F766E] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">{current.badge}</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
        </span>
        <select
          value={current?.key ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
              {o.badge ? ` (${o.badge})` : o.sub ? ` · ${o.sub}` : ""}
            </option>
          ))}
        </select>
      </label>

      <div role="tablist" aria-label={label} className="hidden flex-wrap gap-3 p-[2px] md:flex">
        {options.map((o) => {
          const active = o.key === current?.key;
          return (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(o.key)}
              className={`inline-flex min-h-10 items-center gap-2 px-3.5 py-2 text-left text-xs font-semibold transition-[background-color,color,box-shadow,transform] duration-200 ${
                active
                  ? "bg-[#0369A1] text-white shadow-[0_-2px_0_0_#0369A1,0_2px_0_0_#0369A1,-2px_0_0_0_#0369A1,2px_0_0_0_#0369A1,3px_3px_0_0_#072033]"
                  : "bg-white text-secondary shadow-[0_-2px_0_0_#D9E5ED,0_2px_0_0_#D9E5ED,-2px_0_0_0_#D9E5ED,2px_0_0_0_#D9E5ED] hover:-translate-y-0.5 hover:text-foreground hover:shadow-[0_-2px_0_0_#9CC6E0,0_2px_0_0_#9CC6E0,-2px_0_0_0_#9CC6E0,2px_0_0_0_#9CC6E0,3px_3px_0_0_#9CC6E0]"
              }`}
            >
              <span>{o.label}</span>
              {o.badge && (
                <span className={`px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${active ? "bg-white/20 text-white" : "bg-[#0F766E]/10 text-[#0F766E]"}`}>
                  {o.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
