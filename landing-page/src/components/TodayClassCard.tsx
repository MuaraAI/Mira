"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, Clock, Loader2, MapPin, UserCheck, Wifi, XCircle } from "lucide-react";
import { apiFetch, clearApiCache, useApi } from "@/lib/api";
import { DosenInfo, type TaughtCourse } from "@/components/DosenInfo";
import { useDialog } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/dashboard-ui";
import { clock, describeRoom, type SessionTiming } from "@/lib/schedule";

export interface TodayClass {
  key: string;
  kode: string;
  nama: string;
  jam: string;
  ruang: string;
  sks?: number;
  kode_dosen?: string;
  /** Token presensi MyBest untuk mapel ini (null bila belum cocok dengan daftar MyBest). */
  token: string | null;
  timing: SessionTiming | null;
}

interface PresenceState {
  status_sesi?: string | null;
  can_submit?: boolean;
  present_today?: boolean;
}

type Status = "present" | "open" | "waiting" | "live" | "missed" | "unknown";

const STATUS_COPY: Record<Status, { chip: string; tone: string }> = {
  present: { chip: "Sudah absen", tone: "bg-[#0F766E] text-white" },
  open: { chip: "Absen dibuka", tone: "bg-[#0369A1] text-white" },
  waiting: { chip: "Belum dimulai", tone: "bg-[#F0F7FB] text-secondary" },
  live: { chip: "Menunggu dosen", tone: "bg-[#9A3412]/10 text-[#9A3412]" },
  missed: { chip: "Tidak absen", tone: "bg-[#BE123C]/10 text-[#BE123C]" },
  unknown: { chip: "Status belum ada", tone: "bg-[#F0F7FB] text-secondary" },
};

/**
 * Kartu kelas hari ini di Ringkasan: status absen langsung dari MyBest dan tombol absen
 * sekali ketuk (tanpa pindah ke halaman Presensi). Status dipantau hanya menjelang/selama kelas.
 */
export function TodayClassCard({
  item,
  taughtBy,
  onStatus,
}: {
  item: TodayClass;
  taughtBy?: TaughtCourse[];
  onStatus?: (key: string, present: boolean) => void;
}) {
  const { notify } = useDialog();
  const watching = item.timing?.state === "soon" || item.timing?.state === "live";
  const path = item.token ? `/v1/elearning/presence?token=${item.token}` : "";
  const presence = useApi<PresenceState>(path, { ttlMs: 10_000, persistMs: 10 * 60_000, refreshMs: watching ? 20_000 : null });
  const [submitting, setSubmitting] = useState(false);
  const [justPresent, setJustPresent] = useState(false);

  const data = presence.data;
  const present = justPresent || Boolean(data?.present_today);
  const open = !present && (Boolean(data?.can_submit) || Boolean(data?.status_sesi?.toLowerCase().includes("absen masuk")));
  const state = item.timing?.state;
  const status: Status = !item.token
    ? "unknown"
    : present
      ? "present"
      : open
        ? "open"
        : state === "done"
          ? "missed"
          : state === "live"
            ? "live"
            : data
              ? "waiting"
              : "unknown";

  const known = Boolean(data) || justPresent;
  useEffect(() => {
    if (known) onStatus?.(item.key, present);
  }, [known, present, item.key, onStatus]);

  async function absen() {
    if (!item.token || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>(`/v1/elearning/presence?token=${item.token}`, { method: "POST" });
      if (!res.success) throw new Error(res.message || "Presensi tidak berhasil dikirim.");
      setJustPresent(true);
      onStatus?.(item.key, true);
      clearApiCache("/v1/elearning/presence");
      presence.reload();
      notify(`Presensi ${item.nama} berhasil dicatat.`, "success");
    } catch (err) {
      notify(err instanceof Error && err.message ? err.message : "Presensi gagal dikirim.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const room = describeRoom(item.ruang);
  const RoomIcon = room.mode === "online" ? Wifi : room.mode === "offline" ? Building2 : MapPin;
  const live = state === "live";
  const copy = STATUS_COPY[status];

  return (
    <article
      className={`relative flex flex-col bg-white p-4 sm:p-5 ${
        live
          ? "shadow-[0_0_0_2px_#9A3412,5px_5px_0_0_#FED7AA]"
          : present
            ? "shadow-[0_0_0_2px_#0F766E,5px_5px_0_0_#CCEBE5]"
            : "shadow-[0_0_0_2px_#CFE2EE,5px_5px_0_0_#EAF3F9]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="bg-[#0369A1]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#0369A1]">{item.kode}</span>
            {presence.loading && item.token ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold ${copy.tone}`}>
                {status === "present" && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                {status === "missed" && <XCircle className="h-3 w-3" aria-hidden="true" />}
                {(status === "open" || status === "live") && <span className="px-cursor h-1.5 w-1.5 bg-current" aria-hidden="true" />}
                {copy.chip}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-base font-bold leading-snug text-foreground">{item.nama}</h3>
        </div>
        {item.sks ? <span className="shrink-0 bg-[#F0F7FB] px-2 py-1 font-mono text-[11px] font-semibold text-secondary">{item.sks} SKS</span> : null}
      </div>

      <dl className="mt-3 space-y-1.5 text-[13px]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <dt className="sr-only">Waktu</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono font-semibold text-foreground">{item.jam || "-"}</span>
            {item.timing && <span className={`text-xs ${live ? "font-semibold text-[#9A3412]" : "text-secondary"}`}>{item.timing.label}</span>}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <RoomIcon className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <dt className="sr-only">Ruang</dt>
          <dd className="text-foreground" title={room.code ? `Kode ruang: ${room.code}` : undefined}>
            {room.label}
          </dd>
        </div>
        {item.kode_dosen && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Dosen</dt>
            <dd className="min-w-0 pl-6">
              <DosenInfo kode={item.kode_dosen} courses={taughtBy} className="text-[13px]" />
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 grid gap-2">
        {status === "present" ? (
          <p className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#0F766E]/10 text-sm font-bold text-[#0F766E]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Kamu sudah absen
          </p>
        ) : status === "open" ? (
          <button
            type="button"
            onClick={absen}
            disabled={submitting}
            className="px-btn-success inline-flex min-h-12 items-center justify-center gap-2 px-4 text-sm font-bold text-white"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserCheck className="h-4 w-4" aria-hidden="true" />}
            {submitting ? "Mengirim presensi..." : "Absen sekarang"}
          </button>
        ) : (
          <p className="inline-flex min-h-11 items-center justify-center gap-2 bg-px-tint px-3 text-center text-xs font-semibold text-secondary">
            {status === "missed"
              ? "Sesi absen sudah ditutup"
              : status === "live"
                ? "Tombol aktif otomatis saat dosen membuka absen"
                : status === "waiting" && item.timing?.range
                  ? `Absen dibuka dosen sekitar ${clock(item.timing.range[0])}`
                  : item.token
                    ? "Mengecek status absen..."
                    : "Mapel ini belum ditemukan di MyBest"}
          </p>
        )}
        <Link
          href={`/dashboard/presensi?${new URLSearchParams({ kode: item.kode, mk: item.nama }).toString()}`}
          className="text-center text-xs font-semibold text-[#0369A1] hover:underline"
        >
          Riwayat & rangkuman pertemuan
        </Link>
      </div>
    </article>
  );
}
