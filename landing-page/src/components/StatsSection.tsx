"use client";

import { useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/api";

interface PublicStats {
  users?: { total_all_time?: number; average_per_day?: number };
  requests?: { total_all_time?: number };
  branches?: { name: string; active_users_30d: number }[];
}

function formatId(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

/** Angka count-up yang hormat prefers-reduced-motion: langsung tampil penuh. */
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value]);

  return <>{formatId(display)}</>;
}

/** Section "Mira dalam Angka": 4 angka live dari /v1/stats (refresh 60 detik). */
export function StatsSection() {
  const { data } = useApi<PublicStats>("/v1/stats", { refreshMs: 60_000 });

  const users = data?.users?.total_all_time;
  const avg = data?.users?.average_per_day;
  const requests = data?.requests?.total_all_time;
  const branchesCount = data?.branches?.length || 0;

  return (
    <section id="stats" className="border-b-2 border-px-soft bg-surface-alt/60 scroll-mt-28" aria-labelledby="stats-title">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <h2 id="stats-title" className="font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
          Mira dalam angka
        </h2>
        <p className="mt-4 max-w-lg text-base leading-7 text-secondary">
          Angka asli, update terus dari server. Nggak ada angka karangan.
        </p>

        {typeof users !== "number" ? null : (
          <dl className="mt-10 grid grid-cols-1 gap-6 min-[480px]:grid-cols-2 lg:grid-cols-4">
            <div className="px-card bg-white p-5 sm:p-6">
              <dt className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-secondary">Dipercaya mahasiswa</dt>
              <dd className="mt-3 font-display text-4xl font-bold text-foreground sm:text-5xl">
                <CountUp value={users} />
              </dd>
            </div>
            <div className="px-card bg-white p-5 sm:p-6">
              <dt className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-secondary">Aktif rata-rata per hari</dt>
              <dd className="mt-3 font-display text-4xl font-bold text-foreground sm:text-5xl">
                {typeof avg === "number" ? <CountUp value={avg} /> : "-"}
              </dd>
            </div>
            <div className="px-card bg-white p-5 sm:p-6">
              <dt className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-secondary">Request diproses</dt>
              <dd className="mt-3 font-display text-4xl font-bold text-foreground sm:text-5xl">
                {typeof requests === "number" ? <CountUp value={requests} /> : "-"}
              </dd>
            </div>
            <div className="px-card bg-white p-5 sm:p-6">
              <dt className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-secondary">Total cabang UBSI</dt>
              <dd className="mt-3 font-display text-4xl font-bold text-foreground sm:text-5xl">
                <CountUp value={branchesCount} />
              </dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}
