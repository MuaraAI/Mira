"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CalendarDays, Clock, MapPin, Repeat, User, UserCheck, Wifi } from "lucide-react";
import { useApi } from "@/lib/api";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/dashboard-ui";
import { DosenInfo } from "@/components/DosenInfo";
import { dateTiming, describeRoom, parseIsoDate, shortDate, type RoomInfo, type SessionTiming } from "@/lib/schedule";

/** Kuliah pengganti terdaftar di MyBest (/v1/elearning/makeups). */
interface MakeupItem {
  id: string;
  kode?: string;
  mata_kuliah?: string;
  jadwal?: string;
  tanggal?: string | null;
  hari?: string | null;
  jam?: string | null;
  ruang?: string | null;
  dosen?: string | null;
  kelas?: string | null;
  keterangan?: string;
  token_absen?: string | null;
  absen_path?: string | null;
}

const MAKEUP_PERSIST_MS = 30 * 60 * 1000;
const present = (v?: string | null) => (v && v.trim() && v.trim() !== "-" ? v.trim() : "");

function presensiHref(m: MakeupItem) {
  const params = new URLSearchParams({ kode: present(m.kode), mk: present(m.mata_kuliah), pengganti: m.id });
  return `/dashboard/presensi?${params.toString()}`;
}

function RoomBadge({ info }: { info: RoomInfo }) {
  const Icon = info.mode === "online" ? Wifi : info.mode === "offline" ? Building2 : MapPin;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold ${
        info.mode === "online" ? "bg-[#0369A1]/10 text-[#0369A1]" : info.mode === "offline" ? "bg-[#0F766E]/10 text-[#0F766E]" : "bg-px-tint text-secondary"
      }`}
      title={info.code ? `Kode ruang: ${info.code}` : undefined}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {info.label}
    </span>
  );
}

type Status = "live" | "soon" | "today" | "upcoming" | "past" | "unknown";

const STATUS_META: Record<Status, { label: string; className: string }> = {
  live: { label: "Sedang berlangsung", className: "bg-[#0F766E] text-white" },
  soon: { label: "Segera dimulai", className: "bg-[#9A3412] text-white" },
  today: { label: "Hari ini", className: "bg-[#0369A1] text-white" },
  upcoming: { label: "Akan datang", className: "bg-[#F0F7FB] text-[#075985]" },
  past: { label: "Sudah lewat", className: "bg-[#F0F7FB] text-secondary" },
  unknown: { label: "Tanggal belum jelas", className: "bg-[#F0F7FB] text-secondary" },
};

function statusOf(t: SessionTiming | null, hasDate: boolean): Status {
  if (!hasDate) return "unknown";
  if (!t) return "past";
  if (t.state === "live") return "live";
  if (t.state === "soon") return "soon";
  if (t.daysAway === 0) return t.state === "done" ? "past" : "today";
  return "upcoming";
}

function MakeupCard({ m, timing, status }: { m: MakeupItem; timing: SessionTiming | null; status: Status }) {
  const meta = STATUS_META[status];
  const date = parseIsoDate(m.tanggal);
  const highlight = status === "live" || status === "soon" || status === "today";
  const canOpenAbsen = status !== "past";
  return (
    <article
      className={`glass-card flex h-full flex-col p-4 sm:p-5 ${status === "past" ? "opacity-70" : ""} ${
        highlight ? "[--px-line:#6D28D9] [--px-drop:#C4B5FD]" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {present(m.kode) && <span className="px-chip bg-px-tint px-2 py-0.5 font-mono text-[11px] font-bold text-[#0369A1]">{m.kode}</span>}
        {present(m.kelas) && <span className="px-chip bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-secondary">{m.kelas}</span>}
        <span className={`ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${meta.className}`}>
          {(status === "live" || status === "soon") && <span className="px-cursor h-1.5 w-1.5 bg-white" aria-hidden="true" />}
          {meta.label}
        </span>
      </div>

      <h2 className="mt-3 text-base font-display font-bold leading-snug text-foreground sm:text-lg">{present(m.mata_kuliah) || "Kuliah Pengganti"}</h2>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <CalendarDays className="h-4 w-4 shrink-0 text-[#6D28D9]" aria-hidden="true" />
          <dt className="sr-only">Tanggal</dt>
          <dd className="font-semibold">{date ? `${shortDate(date)} ${date.getFullYear()}` : present(m.jadwal) || "-"}</dd>
        </div>
        {present(m.jam) && (
          <div className="flex items-center gap-2 text-secondary">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Jam</dt>
            <dd className="font-mono text-[13px]">{m.jam!.replace(/\s*-\s*/, " - ")}</dd>
          </div>
        )}
        {present(m.dosen) && (
          <div className="flex items-center gap-2 text-secondary">
            <User className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
            <dt className="sr-only">Dosen</dt>
            <dd className="min-w-0">
              <DosenInfo kode={m.dosen} courses={[]} />
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {present(m.ruang) && <RoomBadge info={describeRoom(m.ruang)} />}
        {timing && status !== "past" && <span className="bg-px-tint px-2 py-0.5 text-xs text-secondary">{timing.label}</span>}
      </div>

      {present(m.keterangan) && (
        <p className="mt-3 border-l-4 border-[#C4B5FD] bg-[#F5F3FF] px-3 py-2 text-xs leading-relaxed text-[#5B21B6]">{m.keterangan}</p>
      )}

      <div className="mt-auto pt-4">
        {canOpenAbsen ? (
          <Link
            href={presensiHref(m)}
            className={`${highlight ? "px-btn-success" : "px-btn"} inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-bold`}
          >
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            {status === "live" || status === "soon" ? "Absen pengganti sekarang" : "Buka absen pengganti"}
          </Link>
        ) : (
          <Link href={presensiHref(m)} className="px-btn inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-bold">
            Lihat riwayat presensi
          </Link>
        )}
      </div>
    </article>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Memuat kuliah pengganti">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass-card space-y-3 p-5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function KuliahPenggantiPage() {
  const api = useApi<MakeupItem[]>("/v1/elearning/makeups", { persistMs: MAKEUP_PERSIST_MS });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const items = useMemo(() => {
    return (api.data ?? []).map((m) => {
      const date = parseIsoDate(m.tanggal);
      const timing = date ? dateTiming(date, m.jam, now) : null;
      return { m, date, timing, status: statusOf(timing, Boolean(date)) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.data, Math.floor(now.getTime() / 60_000)]);

  const rank: Record<Status, number> = { live: 0, soon: 1, today: 2, upcoming: 3, unknown: 4, past: 5 };
  const active = items
    .filter((x) => x.status !== "past")
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0) || (a.timing?.range?.[0] ?? 0) - (b.timing?.range?.[0] ?? 0));
  const past = items.filter((x) => x.status === "past").sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  const todayCount = items.filter((x) => x.status === "live" || x.status === "soon" || x.status === "today").length;
  const upcomingCount = items.filter((x) => x.status === "upcoming").length;

  const header = (
    <PageHeader
      title="Kuliah Pengganti"
      description="Jadwal kuliah pengganti yang didaftarkan dosen di MyBest, lengkap dengan tanggal, jam, ruang, dan absennya."
    />
  );

  if (api.loading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingGrid />
      </div>
    );
  }
  if (api.error) return <ErrorState error={api.error} onRetry={api.reload} />;

  if (items.length === 0) {
    return (
      <div>
        {header}
        <EmptyState
          mascot="/maskot/mura-empty.png"
          title="Belum ada kuliah pengganti."
          description="Kalau dosen menjadwalkan kuliah pengganti di MyBest, jadwal dan absennya muncul di sini."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: "Hari ini", value: todayCount, tone: "text-[#6D28D9]" },
          { label: "Akan datang", value: upcomingCount, tone: "text-[#0369A1]" },
          { label: "Sudah lewat", value: past.length, tone: "text-secondary" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-3 sm:p-4">
            <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">{s.label}</dt>
            <dd className={`mt-1 font-mono text-2xl font-bold ${s.tone}`}>{s.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="pengganti-aktif">
        <h2 id="pengganti-aktif" className="mb-3 flex items-center gap-2 text-base font-display font-bold text-foreground">
          <Repeat className="h-4 w-4 text-[#6D28D9]" aria-hidden="true" />
          Hari Ini &amp; Mendatang
        </h2>
        {active.length === 0 ? (
          <EmptyState title="Tidak ada kuliah pengganti mendatang." description="Semua kuliah pengganti yang terdaftar sudah lewat." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.map(({ m, timing, status }) => (
              <MakeupCard key={m.id} m={m} timing={timing} status={status} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="pengganti-lewat">
          <h2 id="pengganti-lewat" className="mb-3 text-base font-display font-bold text-foreground">
            Sudah Lewat
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {past.map(({ m, timing, status }) => (
              <MakeupCard key={m.id} m={m} timing={timing} status={status} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
