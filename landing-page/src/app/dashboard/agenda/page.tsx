"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Award,
  GraduationCap,
  Palmtree,
  FileText,
  Search,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
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

const CATEGORY_TABS: { key: EventCategory; label: string }[] = [
  { key: "all", label: "Semua Agenda" },
  { key: "ujian", label: "UTS & UAS" },
  { key: "nilai", label: "Nilai" },
  { key: "wisuda", label: "Wisuda" },
  { key: "libur", label: "Libur" },
];

function getCategoryIcon(kategori: string) {
  switch (kategori) {
    case "ujian":
      return FileText;
    case "nilai":
      return Award;
    case "wisuda":
      return GraduationCap;
    case "libur":
      return Palmtree;
    default:
      return CalendarDays;
  }
}

function getCategoryBadge(kategori: string) {
  switch (kategori) {
    case "ujian":
      return "bg-[#0369A1]/10 text-[#0369A1] border-[#0369A1]/30";
    case "nilai":
      return "bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/30";
    case "wisuda":
      return "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/30";
    case "libur":
      return "bg-[#9A3412]/10 text-[#9A3412] border-[#9A3412]/30";
    default:
      return "bg-[#1E293B]/10 text-[#1E293B] border-[#1E293B]/30";
  }
}

export default function AgendaAkademikPage() {
  const { data, loading, error, reload } = useApi<AcademicEvent[]>("/v1/academic/events");
  const [selectedTab, setSelectedTab] = useState<EventCategory>("all");
  const [search, setSearch] = useState("");

  const events = useMemo(() => data ?? [], [data]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchTab = selectedTab === "all" || e.kategori === selectedTab;
      const matchSearch =
        !search.trim() ||
        e.nama.toLowerCase().includes(search.toLowerCase()) ||
        e.tanggal_mulai_raw.toLowerCase().includes(search.toLowerCase());
      return matchTab && matchSearch;
    });
  }, [events, selectedTab, search]);

  const nearestEvent = useMemo(() => {
    const upcoming = events.filter((e) => e.days_left != null && e.days_left >= 0);
    return upcoming.sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999))[0] ?? null;
  }, [events]);

  if (loading) return <LoadingState label="Memuat agenda kegiatan akademik UBSI" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda Kegiatan Akademik"
        description="Jadwal resmi pelaksanaan UTS, UAS, wisuda, pengumuman nilai, dan hari libur semester aktif UBSI."
      />

      {/* Hero Stats */}
      {nearestEvent && (
        <div className="glass-card overflow-hidden border-2 border-px-soft bg-gradient-to-r from-sky-50 via-white to-sky-50/50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-[#0369A1] px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Agenda Terdekat
                </span>
                {nearestEvent.countdown && (
                  <span className="font-mono text-xs font-bold text-[#0369A1]">
                    {nearestEvent.countdown}
                  </span>
                )}
              </div>
              <h2 className="mt-2 font-display text-lg font-bold text-foreground sm:text-xl">
                {nearestEvent.nama}
              </h2>
              <p className="mt-1 font-mono text-xs text-secondary">
                Pelaksanaan: {nearestEvent.tanggal_mulai_raw}
                {nearestEvent.tanggal_selesai_raw !== nearestEvent.tanggal_mulai_raw
                  ? ` s.d. ${nearestEvent.tanggal_selesai_raw}`
                  : ""}
              </p>
            </div>
            <div className="shrink-0">
              <div className="flex h-16 w-16 flex-col items-center justify-center border-2 border-[#0369A1] bg-white text-center shadow-[3px_3px_0_0_#0369A1]">
                <span className="font-mono text-xl font-bold text-[#0369A1]">
                  {nearestEvent.days_left != null ? nearestEvent.days_left : "-"}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-secondary">
                  Hari Lagi
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls: Category Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Kategori agenda" className="flex flex-wrap gap-1 bg-px-tint p-1">
          {CATEGORY_TABS.map((tab) => {
            const active = selectedTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedTab(tab.key)}
                className={`min-h-9 px-3 font-mono text-xs font-bold transition-colors ${
                  active
                    ? "bg-[#0369A1] text-white shadow-[2px_2px_0_0_#072033]"
                    : "text-secondary hover:bg-white hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kegiatan..."
            className="h-9 w-full border-2 border-px-soft bg-white pl-8 pr-3 text-xs text-foreground placeholder:text-secondary focus:border-[#0369A1] focus:outline-none"
          />
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          mascot="/maskot/mura-empty.png"
          title="Tidak ada agenda yang cocok."
          description={search ? `Tidak ada kegiatan yang memuat kata "${search}".` : "Belum ada agenda pada kategori ini."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredEvents.map((e, index) => {
            const Icon = getCategoryIcon(e.kategori);
            const badgeClass = getCategoryBadge(e.kategori);
            const isSoon = e.days_left != null && e.days_left <= 7;

            return (
              <article
                key={e.id || index}
                className={`glass-card flex flex-col p-4 sm:p-5 transition-shadow hover:shadow-[0_0_0_2px_#0369A1] ${
                  isSoon ? "border-l-4 border-l-[#0369A1]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
                    <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {e.kategori}
                  </span>
                  {e.countdown && (
                    <span className={`font-mono text-xs font-bold ${isSoon ? "text-[#9A3412]" : "text-secondary"}`}>
                      {e.countdown}
                    </span>
                  )}
                </div>

                <h3 className="mt-2.5 text-sm font-bold leading-snug text-foreground sm:text-base">
                  {e.nama}
                </h3>

                <div className="mt-auto pt-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed border-px-soft pt-3 font-mono text-xs text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#0369A1]" aria-hidden="true" />
                      <span>{e.tanggal_mulai_raw}</span>
                      {e.tanggal_selesai_raw !== e.tanggal_mulai_raw && (
                        <span> s.d. {e.tanggal_selesai_raw}</span>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="h-3 w-3 text-[#0F766E]" aria-hidden="true" />
                      <span>{e.status}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
