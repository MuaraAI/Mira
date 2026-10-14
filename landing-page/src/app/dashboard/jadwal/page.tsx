"use client";

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
  kelompok_praktek: string | null;
  ruang: string;
  kode_dosen: string;
}

const DAY_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export default function JadwalPage() {
  const { data, loading, error, reload } = useApi<ScheduleItem[]>("/v1/studentv2/schedule");

  if (loading) return <LoadingState label="Memuat jadwal kuliah" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const schedule = data ?? [];
  if (schedule.length === 0) {
    return (
      <div>
        <PageHeader title="Jadwal Kuliah" />
        <EmptyState
          title="Belum ada jadwal kuliah terdaftar."
          description="Pastikan Anda sudah melakukan KRS pada SIAKAD."
        />
      </div>
    );
  }

  const grouped = DAY_ORDER.map((day) => ({
    day,
    items: schedule.filter((s) => s.hari?.toLowerCase() === day.toLowerCase()),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <PageHeader
        title="Jadwal Kuliah"
        description={`Total ${schedule.length} mata kuliah terjadwal minggu ini.`}
      />

      <div className="space-y-6">
        {grouped.map(({ day, items }) => (
          <section key={day} aria-labelledby={`hari-${day}`}>
            <h2 id={`hari-${day}`} className="text-base font-display font-bold tracking-tight mb-3">
              {day}
            </h2>
            <div className="glass-card overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-stroke text-left text-xs font-mono uppercase tracking-widest text-secondary">
                    <th scope="col" className="px-4 py-3">Kode</th>
                    <th scope="col" className="px-4 py-3">Mata Kuliah</th>
                    <th scope="col" className="px-4 py-3">Jam</th>
                    <th scope="col" className="px-4 py-3">Ruang</th>
                    <th scope="col" className="px-4 py-3">SKS</th>
                    <th scope="col" className="px-4 py-3">Dosen</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} className="border-b border-stroke/60 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-[#08738a]">{s.kode}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {s.nama}
                        {s.kelompok_praktek && (
                          <span className="ml-2 text-xs font-normal text-secondary">
                            (Kel. {s.kelompok_praktek})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-secondary">{s.jam}</td>
                      <td className="px-4 py-3 text-secondary">{s.ruang}</td>
                      <td className="px-4 py-3 text-secondary">{s.sks}</td>
                      <td className="px-4 py-3 text-secondary">{s.kode_dosen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
