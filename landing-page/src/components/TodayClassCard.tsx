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

const STATUS_COPY: Record<Status, { chip: string; tone: string; dot: string }> = {
  present: { chip: "Sudah absen", tone: "text-[#0F766E]", dot: "bg-[#0F766E]" },
  open: { chip: "Absen dibuka", tone: "text-[#0369A1]", dot: "bg-[#0369A1]" },
  waiting: { chip: "Belum dimulai", tone: "text-secondary", dot: "bg-secondary/50" },
  live: { chip: "Menunggu dosen", tone: "text-[#9A3412]", dot: "bg-[#9A3412]" },
  missed: { chip: "Tidak absen", tone: "text-[#BE123C]", dot: "bg-[#BE123C]" },
  unknown: { chip: "Status belum ada", tone: "text-secondary", dot: "bg-secondary/50" },
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
  const presence = useApi<PresenceState>(path, {
    ttlMs: 10_000,
    persistMs: 10 * 60_000,
    refreshMs: watching ? 20_000 : null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [justPresent, setJustPresent] = useState(false);

  const data = presence.data;
  const present = justPresent || Boolean(data?.present_today);
  const open =
    !present &&
    (Boolean(data?.can_submit) || Boolean(data?.status_sesi?.toLowerCase().includes("absen masuk")));
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
      const res = await apiFetch<{ success: boolean; message?: string }>(
        `/v1/elearning/presence?token=${item.token}`,
        { method: "POST" }
      );
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
      className={`relative flex flex-col rounded-[10px] border-[1px] bg-white p-4 sm:p-5 ${
        live
          ? "border-[#9A3412]/45"
          : present
            ? "border-[#0F766E]/40"
            : "border-stroke"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] tracking-[0.04em]">
            <span className="text-[#0369A1]">
              {item.kode}
              {item.sks ? ` · ${item.sks} SKS` : ""}
            </span>
            <span className="text-secondary/50" aria-hidden="true">
              ·
            </span>
            {presence.loading && item.token ? (
              <Skeleton className="h-4 w-20" />
            ) : (
              <span className={`inline-flex items-center gap-1.5 font-sans text-xs ${copy.tone}`}>
                <span className={`h-1.5 w-1.5 rounded-[2px] ${copy.dot}`} aria-hidden="true" />
                {status === "present" && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                {status === "missed" && <XCircle className="h-3 w-3" aria-hidden="true" />}
                {copy.chip}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-[15.5px] leading-snug text-foreground">{item.nama}</h3>
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 text-[13px]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <dt className="sr-only">Waktu</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-foreground">{item.jam || "-"}</span>
            {item.timing && (
              <span className={`text-xs ${live ? "text-[#9A3412]" : "text-secondary"}`}>
                {item.timing.label}
              </span>
            )}
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
          <p className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] border-[1px] border-[#0F766E]/25 bg-[#0F766E]/5 text-[13px] text-[#0F766E]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Kamu sudah absen
          </p>
        ) : status === "open" ? (
          <button
            type="button"
            onClick={absen}
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-[#0F766E] px-4 text-[13px] text-white transition-colors hover:bg-[#0D625B] disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserCheck className="h-4 w-4" aria-hidden="true" />
            )}
            {submitting ? "Mengirim presensi..." : "Absen sekarang"}
          </button>
        ) : (
          <p className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-surface-alt px-3 text-center text-xs text-secondary">
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
          className="py-1 text-center text-xs text-[#0369A1] hover:underline"
        >
          Riwayat & rangkuman pertemuan
        </Link>
      </div>
    </article>
  );
}
