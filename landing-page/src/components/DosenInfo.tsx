"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Copy, MapPin, Radio, Wifi } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { DAY_NAMES, clock, dayIndex, dayName, describeRoom, minutesRange } from "@/lib/schedule";
import { formatLecturerName, lecturerName, useLecturers } from "@/lib/lecturers";
import { Skeleton } from "@/components/dashboard-ui";
import { SideSheet } from "@/components/SideSheet";

export interface TaughtCourse {
  nama: string;
  hari?: string;
  jam?: string;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1600);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="px-btn-ghost inline-flex min-h-11 w-full items-center justify-center gap-2 px-3 text-xs font-bold"
    >
      {done ? <Check className="h-4 w-4 text-[#0F766E]" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      <span role="status">{done ? "Tersalin" : label}</span>
    </button>
  );
}

/**
 * Dosen pengampu ditampilkan sebagai "Nama Dosen (KODE)". Diklik membuka info singkat dengan
 * tombol salin nama/kode dan daftar mata kuliah yang diajarnya. Nama berasal dari direktori SIAKAD.
 */
export function DosenInfo({
  kode,
  courses,
  className = "",
}: {
  kode?: string | null;
  /** Mata kuliah milikmu yang diajar dosen ini (opsional, untuk info tambahan). */
  courses?: TaughtCourse[];
  className?: string;
}) {
  const { names, loading } = useLecturers();
  const [open, setOpen] = useState(false);
  const raw = kode?.trim() && kode.trim() !== "-" ? kode.trim() : "";
  // Nilai berspasi berarti MyBest sudah mengirim nama lengkap, bukan kode.
  const isFullName = /\s/.test(raw);
  const code = isFullName ? "" : raw.toUpperCase();
  const nama = isFullName ? formatLecturerName(raw) : lecturerName(names, code);

  if (!raw) return <span className={className}>-</span>;
  if (loading) return <Skeleton className={`h-4 w-32 ${className}`} />;

  const label = code ? (nama ? `${nama} (${code})` : code) : nama ?? raw;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="Lihat info dosen"
        className={`max-w-full text-left font-semibold text-foreground underline decoration-px-water decoration-2 underline-offset-4 transition-colors hover:text-[#0369A1] hover:decoration-[#0369A1] ${className}`}
      >
        <span className="break-words">{label}</span>
      </button>

      <SideSheet
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Info dosen"
        title={nama ?? "Nama belum ada di direktori"}
        subtitle={code ? `Kode dosen ${code}` : undefined}
        titleId="dosen-info-title"
        width="md"
        footer={
          <div className={`grid gap-3 ${nama && code ? "grid-cols-2" : "grid-cols-1"}`}>
            {nama && <CopyButton value={nama} label="Salin nama" />}
            {code && <CopyButton value={code} label="Salin kode" />}
          </div>
        }
      >
        <div className="space-y-6">
          {code && <TeachingProfile kode={code} />}
          {courses && courses.length > 0 ? (
            <section>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">Mengajar kamu di</p>
              <ul className="mt-2 space-y-2">
                {courses.map((c) => (
                  <li key={`${c.nama}-${c.hari}-${c.jam}`} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#0369A1]" aria-hidden="true" />
                    <span className="min-w-0">
                      {c.nama}
                      {(c.hari || c.jam) && <span className="block font-mono text-xs text-secondary">{[dayName(c.hari), c.jam].filter(Boolean).join(" ")}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-sm text-secondary">Belum ada mata kuliahmu yang tercatat untuk dosen ini.</p>
          )}
          <p className="font-mono text-[10px] leading-relaxed text-secondary">
            {isFullName ? "Sumber nama: MyBest." : "Sumber nama: direktori dosen SIAKAD."} Jadwal mengajar dikumpulkan anonim dari jadwal
            kelas pengguna Mira (tanpa data mahasiswa), jadi bisa belum lengkap.
          </p>
        </div>
      </SideSheet>
    </>
  );
}

/* ------------------------------------------------------------------ profil mengajar */

interface TeachingSession {
  kode_mtk: string;
  nama: string;
  kelas: string;
  hari: string;
  jam: string;
  ruang: string;
}

const scheduleCache = new Map<string, { at: number; sessions: TeachingSession[] }>();

function useTeaching(kode: string) {
  const [sessions, setSessions] = useState<TeachingSession[] | null>(() => scheduleCache.get(kode)?.sessions ?? null);
  useEffect(() => {
    let alive = true;
    const hit = scheduleCache.get(kode);
    if (hit && Date.now() - hit.at < 10 * 60_000) return;
    apiFetch<{ sessions: TeachingSession[] }>(`/v1/lecturers/${encodeURIComponent(kode)}/schedule`)
      .then((d) => {
        scheduleCache.set(kode, { at: Date.now(), sessions: d.sessions });
        if (alive) setSessions(d.sessions);
      })
      .catch(() => alive && setSessions([]));
    return () => {
      alive = false;
    };
  }, [kode]);
  return sessions;
}

function RoomLine({ ruang }: { ruang: string }) {
  const info = describeRoom(ruang);
  const Icon = info.mode === "online" ? Wifi : info.mode === "offline" ? Building2 : MapPin;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-secondary">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {info.label}
    </span>
  );
}

/** Sedang mengajar, kelas berikutnya, dan jadwal mingguan lengkap seorang dosen. */
function TeachingProfile({ kode }: { kode: string }) {
  const sessions = useTeaching(kode);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const { live, next, byDay, subjects } = useMemo(() => {
    const list = (sessions ?? []).map((s) => ({ ...s, day: dayIndex(s.hari), range: minutesRange(null, null, s.jam) }));
    const today = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const live = list.find((s) => s.day === today && s.range && nowMin >= s.range[0] && nowMin <= s.range[1]) ?? null;
    // Kelas berikutnya: jarak (hari * 1440 + menit) terkecil dari sekarang, dalam 7 hari.
    let next: (typeof list)[number] | null = null;
    let best = Infinity;
    for (const s of list) {
      if (s.day === null || !s.range || s === live) continue;
      let delta = ((s.day - today + 7) % 7) * 1440 + s.range[0] - nowMin;
      if (delta <= 0) delta += 7 * 1440;
      if (delta < best) {
        best = delta;
        next = s;
      }
    }
    const byDay = DAY_NAMES.map((name, idx) => ({
      name,
      idx,
      items: list.filter((s) => s.day === idx).sort((a, b) => (a.range?.[0] ?? 0) - (b.range?.[0] ?? 0)),
    }))
      .filter((d) => d.items.length)
      // Mulai dari hari ini supaya yang terdekat di atas.
      .sort((a, b) => ((a.idx - today + 7) % 7) - ((b.idx - today + 7) % 7));
    return { live, next, byDay, subjects: [...new Set(list.map((s) => s.nama))] };
  }, [sessions, now]);

  if (sessions === null) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (sessions.length === 0) {
    return <p className="bg-px-tint p-3 text-sm text-secondary">Jadwal mengajar dosen ini belum tercatat. Akan muncul setelah ada pengguna Mira yang diajar dosen ini membuka jadwalnya.</p>;
  }

  return (
    <>
      <section
        className={`p-3 ${live ? "bg-[#0F766E]/10 shadow-[inset_3px_0_0_#0F766E]" : "bg-px-tint shadow-[inset_3px_0_0_#9CC6E0]"}`}
        aria-live="polite"
      >
        <p className={`flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${live ? "text-[#0F766E]" : "text-secondary"}`}>
          {live ? <Radio className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {live ? "Sedang mengajar" : "Tidak sedang mengajar"}
        </p>
        {live ? (
          <div className="mt-1.5 space-y-1">
            <p className="text-sm font-bold text-foreground">{live.nama}</p>
            <p className="font-mono text-xs text-secondary">
              {[live.kelas, live.range ? `sampai ${clock(live.range[1])}` : ""].filter(Boolean).join(" · ")}
            </p>
            <RoomLine ruang={live.ruang} />
          </div>
        ) : null}
        {next && (
          <div className={live ? "mt-3 border-t-2 border-dashed border-px-soft pt-2" : "mt-1.5"}>
            <p className="text-xs text-secondary">
              Berikutnya: <span className="font-semibold text-foreground">{next.nama}</span>
            </p>
            <p className="font-mono text-xs text-secondary">
              {[next.day === now.getDay() ? "Hari ini" : dayName(next.hari), next.jam, next.kelas].filter(Boolean).join(" · ")}
            </p>
          </div>
        )}
      </section>

      <section>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">
          Mengampu {subjects.length} mata kuliah · {sessions.length} kelas
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <span key={s} className="px-chip bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0369A1]">
              {s}
            </span>
          ))}
        </div>
      </section>

      <section>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">Jadwal mengajar mingguan</p>
        <ol className="mt-2 space-y-3">
          {byDay.map((d) => (
            <li key={d.name}>
              <p className="mb-1 text-xs font-bold text-foreground">
                {d.name}
                {d.idx === now.getDay() && <span className="ml-2 bg-[#0369A1] px-1.5 py-px text-[10px] text-white">Hari ini</span>}
              </p>
              <ul className="space-y-1.5">
                {d.items.map((s) => {
                  const isLive = s === live;
                  return (
                    <li
                      key={`${s.kode_mtk}-${s.kelas}-${s.jam}`}
                      className={`px-3 py-2 ${isLive ? "bg-[#0F766E]/10 shadow-[0_0_0_2px_#0F766E]" : "bg-white shadow-[0_0_0_2px_#E4EEF4]"}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 text-sm font-semibold text-foreground">{s.nama}</span>
                        <span className="shrink-0 font-mono text-xs text-secondary">{s.jam || "-"}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {s.kelas && <span className="font-mono text-xs text-secondary">Kelas {s.kelas}</span>}
                        <RoomLine ruang={s.ruang} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
