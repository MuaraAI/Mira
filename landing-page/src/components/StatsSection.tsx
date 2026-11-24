"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ParallaxLayer, RevealOnScroll } from "./HomeParallax";
import { useApi } from "@/lib/api";
import type { RepositoryStats } from "@/lib/github";
import { GITHUB_URL } from "@/lib/public-links";

interface PublicStats {
  users?: { total_all_time?: number; online_now?: number; active_24h?: number };
  requests?: { total_all_time?: number; total_24h?: number };
}

function formatId(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

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

function StatItem({
  label,
  value,
}: {
  label: string;
  value: number | string | undefined;
}) {
  return (
    <div
      className="px-4 py-3.5 sm:px-5 sm:py-4"
      style={{ backgroundColor: "rgba(7, 32, 51, 0.72)" }}
    >
      <dt className="font-mono text-[11px] uppercase tracking-[0.13em] text-[#CBE0EE]">
        {label}
      </dt>
      <dd className="font-display mt-1.5 text-2xl font-semibold leading-none tracking-[-0.01em] text-white tabular-nums sm:mt-2 sm:text-[30px]">
        {typeof value === "number" ? (
          <LiveNumber value={value} />
        ) : typeof value === "string" ? (
          <span className="tabular-nums">{value}</span>
        ) : (
          "-"
        )}
      </dd>
    </div>
  );
}

const PEAK_KEY = "mira_stats_peak";

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

/** Section "Statistik": statistik GitHub MuaraAI/Mira dan statistik server /v1/stats bila aktif. */
export function StatsSection({ githubStats }: { githubStats?: RepositoryStats | null }) {
  const { data } = useApi<PublicStats>("/v1/stats", {
    refreshMs: 15_000,
    ttlMs: 15_000,
  });
  const totalUsers = useMonotonic("users", data?.users?.total_all_time);
  const totalRequests = useMonotonic("requests", data?.requests?.total_all_time);

  return (
    <section
      id="stats"
      className="relative overflow-hidden bg-[#072033] py-10 text-white sm:py-14 scroll-mt-24"
      aria-labelledby="stats-title"
    >
      <ParallaxLayer
        speed={18}
        className="pointer-events-none absolute inset-x-0 -top-10 -bottom-10"
      >
        <Image
          src="/images/hero-ocean-muara.webp"
          alt=""
          fill
          sizes="100vw"
          className="select-none object-cover object-center"
          aria-hidden="true"
        />
      </ParallaxLayer>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(125deg, rgba(7, 32, 51, 0.90) 0%, rgba(7, 32, 51, 0.78) 50%, rgba(7, 32, 51, 0.92) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <div className="max-w-xl">
            <h2
              id="stats-title"
              className="text-[clamp(1.45rem,2.8vw,1.95rem)] leading-[1.18] tracking-[-0.005em] text-white"
            >
              Statistik
            </h2>
            <p className="mt-1.5 text-[13px] leading-[1.6] tracking-[0.012em] text-[#CBE0EE] sm:text-[14px]">
              Angka langsung dari{" "}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline underline-offset-4 hover:text-[#7DD3FC]"
              >
                github.com/MuaraAI/Mira
              </a>{" "}
              dan server Mira.
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delayMs={80}>
          {githubStats || data ? (
            <dl
              className={`mt-6 grid grid-cols-2 gap-[1px] overflow-hidden rounded-[10px] border-[1px] border-white/15 ${
                githubStats && !data ? "md:grid-cols-3" : "md:grid-cols-4"
              }`}
              style={{ backgroundColor: "rgba(255, 255, 255, 0.14)" }}
            >
              {githubStats ? (
                <>
                  <StatItem label="Bintang GitHub" value={githubStats.stars} />
                  <StatItem label="Fork" value={githubStats.forks} />
                  <StatItem label="Kontributor" value={githubStats.contributors ?? undefined} />
                </>
              ) : null}
              {data ? (
                <>
                  <StatItem label="Total pengguna" value={totalUsers} />
                  <StatItem label="Aktif 24 jam" value={data.users?.active_24h} />
                  <StatItem label="Sedang online" value={data.users?.online_now} />
                  <StatItem label="Total request" value={totalRequests} />
                  <StatItem label="Request 24 jam" value={data.requests?.total_24h} />
                </>
              ) : null}
            </dl>
          ) : (
            <div
              className="mt-6 rounded-[10px] border-[1px] border-white/20 p-4 text-[13.5px] leading-[1.65] tracking-[0.012em] text-[#CBE0EE]"
              style={{ backgroundColor: "rgba(7, 32, 51, 0.78)" }}
            >
              Statistik sedang dimuat ulang. Coba muat ulang halaman beberapa saat lagi.
            </div>
          )}
        </RevealOnScroll>
      </div>
    </section>
  );
}
