"use client";

import Link from "next/link";
import { CalendarDays, BellRing, IdCard } from "lucide-react";
import { useApi } from "@/lib/api";
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
  ruang: string;
  kode_dosen: string;
}

interface StudentDashboard {
  schedule?: ScheduleItem[];
  grades?: unknown[];
  news?: unknown[];
  announcements?: unknown[];
}

interface ChannelsResponse {
  channels: { id: number; is_active: boolean }[];
  total: number;
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function DashboardOverviewPage() {
  const me = useApi<{ nim: string; auth_type?: string }>("/v1/auth/me");
  const dash = useApi<StudentDashboard>("/v1/studentv2/dashboard");
  const channels = useApi<ChannelsResponse>("/v1/channels");

  if (me.loading || dash.loading || channels.loading) {
    return <LoadingState label="Menyiapkan ringkasan" />;
  }
  if (me.error) return <ErrorState error={me.error} onRetry={me.reload} />;
  if (dash.error) return <ErrorState error={dash.error} onRetry={dash.reload} />;
  if (channels.error) return <ErrorState error={channels.error} onRetry={channels.reload} />;

  const nim = me.data?.nim ?? "-";
  const today = DAY_NAMES[new Date().getDay()];
  const todaySchedule = (dash.data?.schedule ?? []).filter(
    (s) => s.hari?.toLowerCase() === today.toLowerCase()
  );
  const activeChannels = (channels.data?.channels ?? []).filter((c) => c.is_active).length;

  return (
    <div>
      <PageHeader title={`Halo, ${nim}`} description="Ringkasan aktivitas kampus Anda hari ini." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="glass-card p-6">
          <IdCard className="h-5 w-5 text-[#08738a]" aria-hidden="true" />
          <p className="mt-3 text-xs font-mono uppercase tracking-widest text-secondary font-bold">
            Identitas
          </p>
          <p className="mt-1 text-lg font-bold text-foreground break-words">{nim}</p>
          <p className="text-sm text-secondary">
            Session {me.data?.auth_type === "session" ? "mahasiswa aktif" : "terhubung"}
          </p>
        </div>

        <div className="glass-card p-6">
          <BellRing className="h-5 w-5 text-[#08738a]" aria-hidden="true" />
          <p className="mt-3 text-xs font-mono uppercase tracking-widest text-secondary font-bold">
            Channel Notifikasi
          </p>
          <p className="mt-1 text-lg font-bold text-foreground">
            {activeChannels} aktif dari {channels.data?.total ?? 0}
          </p>
          <Link
            href="/dashboard/notifikasi"
            className="mt-1 inline-block text-sm font-semibold text-[#0369a1] underline underline-offset-4"
          >
            Kelola channel
          </Link>
        </div>

        <div className="glass-card p-6">
          <CalendarDays className="h-5 w-5 text-[#08738a]" aria-hidden="true" />
          <p className="mt-3 text-xs font-mono uppercase tracking-widest text-secondary font-bold">
            Jadwal Hari {today}
          </p>
          <p className="mt-1 text-lg font-bold text-foreground">
            {todaySchedule.length} kelas
          </p>
          <Link
            href="/dashboard/jadwal"
            className="mt-1 inline-block text-sm font-semibold text-[#0369a1] underline underline-offset-4"
          >
            Lihat jadwal mingguan
          </Link>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="jadwal-hari-ini">
        <h2 id="jadwal-hari-ini" className="text-lg font-display font-bold tracking-tight mb-4">
          Kelas Hari {today}
        </h2>
        {todaySchedule.length === 0 ? (
          <EmptyState
            title="Tidak ada jadwal kelas hari ini."
            description="Nikmati harimu, atau periksa jadwal hari lain di halaman Jadwal."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {todaySchedule.map((s) => (
              <li key={s.id} className="glass-card p-5">
                <p className="font-mono text-xs font-bold text-[#08738a]">{s.kode}</p>
                <p className="mt-1 font-bold text-foreground">{s.nama}</p>
                <p className="mt-1 text-sm text-secondary">
                  {s.jam} : {s.ruang} : {s.kode_dosen}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
