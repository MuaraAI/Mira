"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Clock, Search, X } from "lucide-react";
import { useApi } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/dashboard-ui";

interface AcademicEvent {
  id: string;
  nama: string;
  tanggal_mulai?: string | null;
  tanggal_selesai?: string | null;
  tanggal_mulai_raw: string;
  tanggal_selesai_raw: string;
  status: string;
  countdown?: string | null;
  days_left?: number | null;
  kategori: "ujian" | "nilai" | "wisuda" | "libur" | "registrasi" | "akademik";
}

type EventCategory = "all" | "ujian" | "nilai" | "wisuda" | "libur";
type ResolvedCategory = "ujian" | "nilai" | "wisuda" | "libur" | "akademik";

const CATEGORY_TABS: { key: EventCategory; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "ujian", label: "Ujian" },
  { key: "nilai", label: "Nilai" },
  { key: "wisuda", label: "Wisuda" },
  { key: "libur", label: "Libur" },
];

const CATEGORY_LABELS: Record<ResolvedCategory, string> = {
  ujian: "Ujian",
  nilai: "Nilai",
  wisuda: "Wisuda",
  libur: "Libur",
  akademik: "Akademik",
};

function resolveCategory(e: AcademicEvent): ResolvedCategory {
  const text = e.nama.toLowerCase();
  if (/\b(nilai|khs|ipk|her nilai|perbaikan nilai)\b/.test(text)) return "nilai";
  if (/\b(wisuda|toga|yudisium)\b/.test(text)) return "wisuda";
  if (/\b(libur|cuti)\b/.test(text)) return "libur";
  if (/\b(uts|uas|ujian|her)\b/.test(text)) return "ujian";
  if (
    e.kategori === "ujian" ||
    e.kategori === "nilai" ||
    e.kategori === "wisuda" ||
    e.kategori === "libur"
  ) {
    return e.kategori;
  }
  return "akademik";
}

function parseDateTile(raw: string): { day: string; month: string } {
  const match = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]+)/);
  if (match) {
    return { day: match[1].padStart(2, "0"), month: match[2].slice(0, 3).toUpperCase() };
  }
  return { day: "--", month: "TGL" };
}

function isEventOngoing(e: AcademicEvent): boolean {
  const status = (e.status || "").toLowerCase();
  const countdown = (e.countdown || "").toLowerCase();
  return status.includes("berlangsung") || countdown.includes("berlangsung");
}

function formatDateRange(start: string, end: string): string {
  if (!end || end === start) return start;
  return `${start} s.d. ${end}`;
}

export default function InfoKampusPage() {
  const { data, loading, error, reload } = useApi<AcademicEvent[]>("/v1/academic/events");
  const [selectedTab, setSelectedTab] = useState<EventCategory>("all");
  const [search, setSearch] = useState("");

  const events = useMemo(() => {
    return (data ?? []).map((item) => ({
      ...item,
      resolvedCategory: resolveCategory(item),
    }));
  }, [data]);

  const counts = useMemo(() => {
    const map: Record<EventCategory, number> = {
      all: events.length,
      ujian: 0,
      nilai: 0,
      wisuda: 0,
      libur: 0,
    };
    for (const e of events) {
      if (e.resolvedCategory !== "akademik") {
        map[e.resolvedCategory] += 1;
      }
    }
    return map;
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      const matchTab = selectedTab === "all" || e.resolvedCategory === selectedTab;
      const matchSearch =
        !q ||
        e.nama.toLowerCase().includes(q) ||
        e.tanggal_mulai_raw.toLowerCase().includes(q) ||
        e.tanggal_selesai_raw.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [events, selectedTab, search]);

  const spotlightEvent = useMemo(() => {
    const ongoing = events.find((e) => isEventOngoing(e));
    if (ongoing) return ongoing;
    const upcoming = events
      .filter((e) => e.days_left != null && e.days_left >= 0)
      .sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999));
    return upcoming[0] ?? events[0] ?? null;
  }, [events]);

  if (loading) return <LoadingState label="Memuat info dan jadwal kampus UBSI" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const spotlightOngoing = spotlightEvent ? isEventOngoing(spotlightEvent) : false;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Info & Jadwal Kampus"
        description="Pengumuman resmi jadwal UTS, UAS, rilis nilai, wisuda, dan hari libur semester aktif UBSI."
      />

      {/* Restrained Editorial Spotlight Header (WebP wave backdrop, zero floating glass boxes) */}
      {spotlightEvent && (
        <section
          aria-label="Info kampus utama"
          className="relative overflow-hidden rounded-[12px] border-[1px] border-[#0E2F4A] bg-[#051624] text-white"
        >
          <Image
            src="/images/info-banner-muara.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 960px"
            className="select-none object-cover object-center"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#9AD8F8]">
                {spotlightOngoing ? "Sedang Berlangsung" : "Terdekat"} ·{" "}
                {CATEGORY_LABELS[spotlightEvent.resolvedCategory]}
              </p>

              <h2 className="font-home-display break-words text-lg leading-snug text-white sm:text-xl">
                {spotlightEvent.nama}
              </h2>

              <p className="inline-flex items-center gap-1.5 font-mono text-xs text-[#CBE0EE]">
                <Clock className="h-3.5 w-3.5 shrink-0 text-[#7DD3FC]" aria-hidden="true" />
                <span>
                  {formatDateRange(
                    spotlightEvent.tanggal_mulai_raw,
                    spotlightEvent.tanggal_selesai_raw
                  )}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-baseline gap-2 border-t-[1px] border-white/15 pt-3 sm:flex-col sm:items-end sm:border-l-[1px] sm:border-t-0 sm:pl-6 sm:pt-0">
              <span className="font-display text-2xl font-semibold leading-none tracking-[-0.01em] text-white tabular-nums sm:text-3xl">
                {spotlightOngoing
                  ? "LIVE"
                  : spotlightEvent.days_left != null
                    ? String(spotlightEvent.days_left).padStart(2, "0")
                    : "-"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#9AD8F8]">
                {spotlightOngoing ? "Periode aktif" : "Hari lagi"}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Filter Bar + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Filter kategori info kampus"
          className="scroll-slim flex gap-1.5 overflow-x-auto pb-0.5"
        >
          {CATEGORY_TABS.map((tab) => {
            const active = selectedTab === tab.key;
            const count = counts[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedTab(tab.key)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] border-[1px] px-3 text-xs font-medium transition-colors ${
                  active
                    ? "border-[#072033] bg-[#072033] text-white"
                    : "border-stroke bg-white text-secondary hover:border-[#072033]/40 hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono text-[10.5px] tabular-nums ${
                    active ? "text-white/75" : "text-secondary/70"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari pengumuman atau jadwal kampus"
            placeholder="Cari info atau tanggal..."
            className="h-9 w-full rounded-[6px] border-[1px] border-stroke bg-white pl-9 pr-8 text-xs text-foreground placeholder:text-secondary/75 focus:border-[#072033] focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Hapus pencarian"
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[4px] text-secondary hover:bg-[#F0F7FB] hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Monochrome Architectural Announcement Cards (Zero Rainbow Pastel Badges) */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          mascot="/maskot/mura-empty.png"
          title="Belum ada info yang cocok."
          description={
            search
              ? `Tidak ditemukan info kampus yang memuat "${search}".`
              : "Belum ada pengumuman untuk kategori ini pada semester aktif."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {filteredEvents.map((e, index) => {
            const ongoing = isEventOngoing(e);
            const isSoon = !ongoing && e.days_left != null && e.days_left >= 0 && e.days_left <= 7;
            const tile = parseDateTile(e.tanggal_mulai_raw);
            const timingLabel = ongoing
              ? "Berlangsung"
              : e.countdown || e.status || "Terjadwal";

            return (
              <article
                key={e.id || index}
                className="flex min-w-0 gap-3.5 rounded-[10px] border-[1px] border-stroke bg-white p-4 transition-colors hover:border-[#072033]/35 sm:gap-4 sm:p-5"
              >
                {/* Disciplined Monochrome Date Tile */}
                <div
                  className="flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[8px] border-[1px] border-stroke bg-[#F7FAFC] text-center"
                  aria-hidden="true"
                >
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-secondary">
                    {tile.month}
                  </span>
                  <span className="mt-0.5 font-display text-[17px] font-bold leading-none text-foreground tabular-nums">
                    {tile.day}
                  </span>
                </div>

                {/* Details: plain architectural typography, zero pastel badge pills */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary">
                      {CATEGORY_LABELS[e.resolvedCategory]}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[11px] ${
                        ongoing
                          ? "font-semibold text-foreground"
                          : isSoon
                            ? "font-medium text-[#0369A1]"
                            : "text-secondary"
                      }`}
                    >
                      {timingLabel}
                    </span>
                  </div>

                  <h3 className="mt-1.5 break-words text-[14.5px] font-medium leading-snug text-foreground sm:text-[15px]">
                    {e.nama}
                  </h3>

                  <p className="mt-auto flex items-center gap-1.5 pt-3 font-mono text-[11.5px] text-secondary">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-secondary/75" aria-hidden="true" />
                    <span className="truncate">
                      {formatDateRange(e.tanggal_mulai_raw, e.tanggal_selesai_raw)}
                    </span>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
