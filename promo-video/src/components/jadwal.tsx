import React from "react";
import { BookOpen, Clock, MapPin, User, UserCheck } from "lucide-react";
import { WEEK } from "../data";
import { PageHeader } from "./ui";
import { pageIn, riseStyle } from "./motion";

/** Halaman Jadwal Kuliah (dashboard/jadwal/page.tsx), versi desktop. */

const STATUS_META = {
  live: { label: "Sedang berlangsung", className: "bg-[#0F766E] text-white" },
  next: { label: "Berikutnya", className: "bg-[#0369A1] text-white" },
  done: { label: "Selesai", className: "bg-[#F0F7FB] text-secondary" },
  upcoming: { label: "Nanti", className: "bg-[#F0F7FB] text-[#075985]" },
};

type Item = (typeof WEEK)[number]["items"][number] & { status?: keyof typeof STATUS_META };

const ClassCard: React.FC<{ s: Item; style?: React.CSSProperties; anchor?: string }> = ({ s, style, anchor }) => {
  const meta = s.status ? STATUS_META[s.status] : null;
  const highlight = s.status === "live" || s.status === "next";
  return (
    <article
      data-anchor={anchor}
      className="glass-card flex h-full flex-col p-5"
      style={{
        ...(s.status === "next" ? { ["--px-line" as string]: "#0369A1", ["--px-drop" as string]: "#9CC6E0" } : {}),
        ...style,
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-chip bg-px-tint px-2 py-0.5 font-mono text-[11px] font-bold text-[#0369A1]">{s.kode}</span>
        <span className="px-chip bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-secondary">{s.sks} SKS</span>
        {meta && <span className={`ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${meta.className}`}>{meta.label}</span>}
      </div>
      <h3 className="mt-3 text-base font-bold leading-snug text-foreground">{s.nama}</h3>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t-2 border-dashed border-px-soft pt-3 text-xs">
        <div className="col-span-2 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" />
          <dd className="font-mono font-semibold text-foreground">{s.jam}</dd>
        </div>
        <div className="col-span-2 flex min-w-0 items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" />
          <dd className="min-w-0 break-words text-secondary">{s.room}</dd>
        </div>
        <div className="col-span-2 flex min-w-0 items-start gap-2">
          <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0369A1]" />
          <dd className="min-w-0 font-semibold text-foreground underline decoration-px-water decoration-2 underline-offset-4">{s.dosen}</dd>
        </div>
      </dl>
      <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
        <span className={`${highlight ? "px-btn" : "px-btn-ghost"} inline-flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-bold`}>
          <UserCheck className="h-3.5 w-3.5" />
          Absen
        </span>
        <span className="px-btn-ghost inline-flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-semibold">
          <BookOpen className="h-3.5 w-3.5" />
          Materi
        </span>
      </div>
    </article>
  );
};

export const JadwalPage: React.FC<{ t: number; load: number; tab: "today" | "week"; weekAt: number; hoverWeek?: boolean }> = ({ t, load, tab, weekAt, hoverWeek }) => {
  const today = WEEK[0].items as Item[];
  return (
    <div className="space-y-6" style={pageIn(t, load)}>
      <PageHeader title="Jadwal Kuliah" description="6 mata kuliah minggu ini (SIAKAD)." />
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 bg-px-tint p-1 shadow-[0_-2px_0_0_#CFE2EE,0_2px_0_0_#CFE2EE,-2px_0_0_0_#CFE2EE,2px_0_0_0_#CFE2EE]" style={{ width: "20rem" }}>
          <span className={`flex min-h-10 items-center justify-center px-3 font-mono text-xs font-bold ${tab === "today" ? "bg-[#0369A1] text-white shadow-[2px_2px_0_0_#072033]" : "text-secondary"}`}>Hari Ini (2)</span>
          <span
            data-anchor="tab-week"
            className={`flex min-h-10 items-center justify-center px-3 font-mono text-xs font-bold ${tab === "week" ? "bg-[#0369A1] text-white shadow-[2px_2px_0_0_#072033]" : hoverWeek ? "bg-white text-foreground" : "text-secondary"}`}
          >
            Minggu Ini (6)
          </span>
        </div>
        <p className="font-mono text-xs text-secondary">
          Senin · <span className="font-bold text-foreground">07.41</span>
        </p>
      </div>

      {tab === "today" ? (
        <section className="grid grid-cols-3 gap-5 p-[2px]">
          {today.map((s, i) => (
            <ClassCard key={s.kode} s={s} anchor={`today-${i}`} style={riseStyle(t, load + 0.12 + i * 0.1, 0.6, 16)} />
          ))}
        </section>
      ) : (
        <section className="space-y-8" style={pageIn(t, weekAt)}>
          {WEEK.map(({ day, today: isToday, items }, d) => (
            <section key={day} style={riseStyle(t, weekAt + d * 0.1, 0.55, 14)}>
              <h2 className="mb-3 flex items-center gap-2 text-base font-display font-bold tracking-tight">
                {day}
                {isToday && <span className="bg-[#0F766E] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">Hari ini</span>}
                <span className="font-mono text-xs font-normal text-secondary">{items.length} kelas</span>
              </h2>
              <div className="grid grid-cols-3 gap-5 p-[2px]">
                {(items as Item[]).map((s) => (
                  <ClassCard key={s.kode} s={isToday ? s : { ...s, status: undefined }} />
                ))}
              </div>
            </section>
          ))}
        </section>
      )}
    </div>
  );
};
