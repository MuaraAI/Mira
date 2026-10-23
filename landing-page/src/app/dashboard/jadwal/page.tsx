"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, MapPin, User, UserCheck } from "lucide-react";
import { useApi } from "@/lib/api";
import { DosenInfo } from "@/components/DosenInfo";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/dashboard-ui";

interface ScheduleItem {
  id: string;
  kode: string;
  nama: string;
  hari: string;
  jam: string;
  sks: number;
  kelompok_praktek: string | null;
  ruang: string;
  kode_dosen: string;
}

type ClassStatus = "live" | "next" | "done" | "upcoming";

const DAY_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const JS_DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "07:30 - 10:00" -> [450, 600] dalam menit sejak tengah malam. */
function parseRange(jam: string): [number, number] | null {
  const times = Array.from(jam?.matchAll(/(\d{1,2})[:.](\d{2})/g) ?? []).map(
    (m) => Number(m[1]) * 60 + Number(m[2])
  );
  if (times.length < 2) return null;
  return [times[0], times[1]];
}

function sameDay(a?: string, b?: string) {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/** Semua jadwal milikmu yang diajar dosen yang sama. */
function taughtBy(schedule: ScheduleItem[], s: ScheduleItem) {
  const code = s.kode_dosen?.trim().toUpperCase();
  return code && code !== "-" ? schedule.filter((x) => x.kode_dosen?.trim().toUpperCase() === code) : [s];
}

function presensiHref(s: ScheduleItem) {
  const params = new URLSearchParams({ kode: s.kode ?? "", mk: s.nama ?? "" });
  return `/dashboard/presensi?${params.toString()}`;
}

const STATUS_META: Record<ClassStatus, { label: string; className: string }> = {
  live: { label: "Sedang berlangsung", className: "bg-[#0F766E] text-white" },
  next: { label: "Berikutnya", className: "bg-[#0369A1] text-white" },
  done: { label: "Selesai", className: "bg-[#F0F7FB] text-secondary" },
  upcoming: { label: "Nanti", className: "bg-[#F0F7FB] text-[#075985]" },
};

function ClassCard({ s, status, taught }: { s: ScheduleItem; status?: ClassStatus; taught: ScheduleItem[] }) {
  const meta = status ? STATUS_META[status] : null;
  const highlight = status === "live" || status === "next";
  return (
    <article
      className={`glass-card flex h-full flex-col p-4 sm:p-5 ${status === "done" ? "opacity-70" : ""} ${
        status === "live" ? "[--px-line:#0F766E] [--px-drop:#99D5CC]" : status === "next" ? "[--px-line:#0369A1] [--px-drop:#9CC6E0]" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-chip bg-px-tint px-2 py-0.5 font-mono text-[11px] font-bold text-[#0369A1]">{s.kode}</span>
        <span className="px-chip bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-secondary">{s.sks} SKS</span>
        {meta && (
          <span className={`ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${meta.className}`}>
            {status === "live" && <span className="px-cursor h-1.5 w-1.5 bg-white" aria-hidden="true" />}
            {meta.label}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-base font-bold leading-snug text-foreground">
        {s.nama}
        {s.kelompok_praktek && (
          <span className="mt-0.5 block text-xs font-normal text-secondary">Kel. {s.kelompok_praktek}</span>
        )}
      </h3>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t-2 border-dashed border-px-soft pt-3 text-xs">
        <div className="col-span-2 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <dt className="sr-only">Jam</dt>
          <dd className="font-mono font-semibold text-foreground">{s.jam || "-"}</dd>
        </div>
        <div className="col-span-2 flex min-w-0 items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <dt className="sr-only">Ruang</dt>
          <dd className="min-w-0 break-words text-secondary">{s.ruang || "-"}</dd>
        </div>
        <div className="col-span-2 flex min-w-0 items-start gap-2">
          <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <dt className="sr-only">Dosen</dt>
          <dd className="min-w-0">
            <DosenInfo kode={s.kode_dosen} courses={taught.map((t) => ({ nama: t.nama, hari: t.hari, jam: t.jam }))} />
          </dd>
        </div>
      </dl>

      <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
        <Link
          href={presensiHref(s)}
          className={`${highlight ? "px-btn" : "px-btn-ghost"} inline-flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-bold`}
        >
          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Absen
        </Link>
        <Link
          href="/dashboard/materi"
          className="px-btn-ghost inline-flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-semibold"
        >
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Materi
        </Link>
      </div>
    </article>
  );
}

export default function JadwalPage() {
  const { data, loading, error, reload } = useApi<ScheduleItem[]>("/v1/studentv2/schedule");
  const [tab, setTab] = useState<"today" | "week">("today");
  const [now, setNow] = useState<Date | null>(null);

  // Jam dihitung di browser saja (hindari mismatch SSR) dan diperbarui tiap menit.
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const schedule = useMemo(() => data ?? [], [data]);
  const today = now ? JS_DAY_NAMES[now.getDay()] : "";
  const minutesNow = now ? now.getHours() * 60 + now.getMinutes() : 0;

  const todayClasses = useMemo(() => {
    const items = schedule.filter((s) => sameDay(s.hari, today));
    return items.sort((a, b) => (parseRange(a.jam)?.[0] ?? 0) - (parseRange(b.jam)?.[0] ?? 0));
  }, [schedule, today]);

  const todayStatus = useMemo(() => {
    const result = new Map<string, ClassStatus>();
    let nextAssigned = false;
    for (const s of todayClasses) {
      const range = parseRange(s.jam);
      if (!range) continue;
      if (minutesNow >= range[0] && minutesNow < range[1]) result.set(s.id, "live");
      else if (minutesNow >= range[1]) result.set(s.id, "done");
      else if (!nextAssigned) {
        result.set(s.id, "next");
        nextAssigned = true;
      } else result.set(s.id, "upcoming");
    }
    return result;
  }, [todayClasses, minutesNow]);

  const nextDay = useMemo(() => {
    if (!now) return null;
    for (let offset = 1; offset <= 7; offset++) {
      const day = JS_DAY_NAMES[(now.getDay() + offset) % 7];
      const items = schedule.filter((s) => sameDay(s.hari, day));
      if (items.length > 0) return { day, count: items.length, offset };
    }
    return null;
  }, [schedule, now]);

  if (loading) return <LoadingState label="Memuat jadwal kuliah" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  if (schedule.length === 0) {
    return (
      <div>
        <PageHeader title="Jadwal Kuliah" />
        <EmptyState
          mascot="/maskot/mura-empty.png"
          title="Belum ada jadwal kuliah terdaftar."
          description="Pastikan kamu sudah isi KRS di SIAKAD."
        />
      </div>
    );
  }

  const grouped = DAY_ORDER.map((day) => ({
    day,
    items: schedule.filter((s) => sameDay(s.hari, day)),
  })).filter((g) => g.items.length > 0);

  const clock = now ? now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "--:--";

  return (
    <div>
      <PageHeader
        title="Jadwal Kuliah"
        description={`${schedule.length} mata kuliah minggu ini.`}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Tampilan jadwal" className="grid grid-cols-2 gap-1 bg-px-tint p-1 shadow-[0_-2px_0_0_#CFE2EE,0_2px_0_0_#CFE2EE,-2px_0_0_0_#CFE2EE,2px_0_0_0_#CFE2EE] sm:w-80">
          {([
            ["today", `Hari Ini${todayClasses.length ? ` (${todayClasses.length})` : ""}`],
            ["week", `Minggu Ini (${schedule.length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              onClick={() => setTab(key)}
              className={`min-h-10 px-3 font-mono text-xs font-bold transition-colors duration-200 ${
                tab === key ? "bg-[#0369A1] text-white shadow-[2px_2px_0_0_#072033]" : "text-secondary hover:bg-white hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-mono text-xs text-secondary">
          {today || "Hari ini"} · <span className="font-bold text-foreground">{clock}</span>
        </p>
      </div>

      {tab === "today" ? (
        <section id="panel-today" role="tabpanel" aria-labelledby="tab-today" className="page-in">
          {todayClasses.length === 0 ? (
            <EmptyState
              title={`Tidak ada jadwal kuliah hari ${today}.`}
              description={
                nextDay
                  ? `Kuliah berikutnya hari ${nextDay.day} (${nextDay.count} mata kuliah).`
                  : "Nikmati waktu luangmu atau cicil tugas perkuliahan di MyBest."
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 p-[2px] md:grid-cols-2 xl:grid-cols-3">
              {todayClasses.map((s) => (
                <ClassCard key={s.id} s={s} status={todayStatus.get(s.id)} taught={taughtBy(schedule, s)} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section id="panel-week" role="tabpanel" aria-labelledby="tab-week" className="page-in space-y-8">
          {grouped.map(({ day, items }) => {
            const isToday = sameDay(day, today);
            return (
              <section key={day} aria-labelledby={`hari-${day}`}>
                <h2 id={`hari-${day}`} className="mb-3 flex items-center gap-2 text-base font-display font-bold tracking-tight">
                  {day}
                  {isToday && (
                    <span className="bg-[#0F766E] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">Hari ini</span>
                  )}
                  <span className="font-mono text-xs font-normal text-secondary">{items.length} kelas</span>
                </h2>
                <div className="grid grid-cols-1 gap-5 p-[2px] md:grid-cols-2 xl:grid-cols-3">
                  {items.map((s) => (
                    <ClassCard key={s.id} s={s} status={isToday ? todayStatus.get(s.id) : undefined} taught={taughtBy(schedule, s)} />
                  ))}
                </div>
              </section>
            );
          })}
        </section>
      )}
    </div>
  );
}
