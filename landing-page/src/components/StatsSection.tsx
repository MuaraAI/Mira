"use client";

import { useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/api";

interface PublicStats {
  users?: { total_all_time?: number; online_now?: number; active_24h?: number };
  requests?: { total_all_time?: number; total_24h?: number };
}

function formatId(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Angka yang meluncur dari nilai sebelumnya ke nilai baru (bukan mulai ulang dari 0).
 * Hitung naik pertama baru jalan saat kartu terlihat; saat tab tersembunyi atau
 * prefers-reduced-motion aktif, angka langsung diganti tanpa animasi.
 */
function LiveNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const [display, setDisplay] = useState(0);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setSeen(true));
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    const from = shown.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (from === value || reduced || document.visibilityState === "hidden") {
      shown.current = value;
      setDisplay(value);
      return;
    }
    const duration = from === 0 ? 900 : 600;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = Math.round(from + (value - from) * easeOut(progress));
      shown.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, seen]);

  return (
    <span ref={ref} className="tabular-nums">
      {formatId(display)}
    </span>
  );
}

function StatCard({ label, value, live = false }: { label: string; value: number | undefined; live?: boolean }) {
  return (
    <div className="px-card bg-white p-5 sm:p-6">
      <dt className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.18em] text-secondary">
        {live && <span className="stats-live-dot" aria-hidden="true" />}
        {label}
      </dt>
      <dd className="mt-3 font-display text-4xl font-bold text-foreground sm:text-5xl">
        {typeof value === "number" ? <LiveNumber value={value} /> : "-"}
      </dd>
    </div>
  );
}

const PEAK_KEY = "mira_stats_peak";

/**
 * Total all-time hanya boleh naik. Kalau server sempat mengirim angka lebih kecil
 * (mis. backend lama yang menghitung dari data 30 hari), tampilkan angka tertinggi
 * yang pernah terlihat di perangkat ini.
 */
function useMonotonic(name: string, value: number | undefined): number | undefined {
  const [peak, setPeak] = useState<number | undefined>(undefined);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PEAK_KEY) || "{}")[name];
      if (typeof stored === "number") setPeak(stored);
    } catch {
      /* localStorage tidak tersedia: cukup pakai nilai sesi ini */
    }
  }, [name]);

  useEffect(() => {
    if (typeof value !== "number") return;
    setPeak((prev) => {
      const next = Math.max(prev ?? 0, value);
      try {
        const all = JSON.parse(localStorage.getItem(PEAK_KEY) || "{}");
        localStorage.setItem(PEAK_KEY, JSON.stringify({ ...all, [name]: next }));
      } catch {
        /* abaikan */
      }
      return next;
    });
  }, [name, value]);

  return typeof value === "number" ? Math.max(peak ?? 0, value) : peak;
}

/** Section "Statistik": statistik realtime dari /v1/stats (refresh 15 detik saat tab terlihat). */
export function StatsSection() {
  const { data } = useApi<PublicStats>("/v1/stats", { refreshMs: 15_000, ttlMs: 15_000 });
  const totalUsers = useMonotonic("users", data?.users?.total_all_time);
  const totalRequests = useMonotonic("requests", data?.requests?.total_all_time);

  return (
    <section id="stats" className="border-b-2 border-px-soft bg-surface-alt/60 scroll-mt-28" aria-labelledby="stats-title">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <h2 id="stats-title" className="font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
          Statistik
        </h2>
        <p className="mt-4 max-w-lg text-base leading-7 text-secondary">
          Statistik realtime langsung dari server, diperbarui otomatis. Nggak ada angka karangan.
        </p>

        {data && (
          <dl className="mt-10 grid grid-cols-1 gap-6 min-[480px]:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total pengguna" value={totalUsers} />
            <StatCard label="Sedang online" value={data.users?.online_now} live />
            <StatCard label="Total request" value={totalRequests} />
            <StatCard label="Request 24 jam" value={data.requests?.total_24h} />
          </dl>
        )}
      </div>
    </section>
  );
}
