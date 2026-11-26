"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ParallaxLayer, RevealOnScroll } from "./HomeParallax";
import { useApi } from "@/lib/api";
import type { RepositoryStats } from "@/lib/github";
import { GITHUB_URL } from "@/lib/public-links";

interface StatBreakdownItem {
  name: string;
  active_users_30d?: number;
  total_all_time?: number;
}

interface PublicStats {
  users?: { total_all_time?: number; online_now?: number; active_24h?: number };
  requests?: { total_all_time?: number; total_24h?: number };
  branches?: StatBreakdownItem[];
  programs?: StatBreakdownItem[];
}

interface BreakdownRow {
  name: string;
  count: number;
}

const INITIAL_BREAKDOWN_LIMIT = 8;

function normalizeBreakdown(items: StatBreakdownItem[] | undefined): BreakdownRow[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      name: (item.name || "").trim(),
      count:
        typeof item.total_all_time === "number"
          ? item.total_all_time
          : typeof item.active_users_30d === "number"
            ? item.active_users_30d
            : 0,
    }))
    .filter((item) => item.name.length > 0 && item.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "id-ID"));
}

function formatId(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function LiveNumber({ value, active }: { value: number; active?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const [display, setDisplay] = useState(0);
  const [observed, setObserved] = useState(false);
  const seen = active ?? observed;

  useEffect(() => {
    if (active !== undefined) return;
    const node = ref.current;
    if (!node || observed) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setObserved(true));
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, observed]);

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
  active,
}: {
  label: string;
  value: number | string | undefined;
  active?: boolean;
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
          <LiveNumber value={value} active={active} />
        ) : typeof value === "string" ? (
          <span className="tabular-nums">{value}</span>
        ) : (
          "-"
        )}
      </dd>
    </div>
  );
}

function BreakdownPanel({
  title,
  unitLabel,
  items,
  emptyMessage,
  active,
}: {
  title: string;
  unitLabel: string;
  items: BreakdownRow[];
  emptyMessage: string;
  active: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const maxCount = items[0]?.count ?? 0;
  const visibleItems = expanded ? items : items.slice(0, INITIAL_BREAKDOWN_LIMIT);
  const hasMore = items.length > INITIAL_BREAKDOWN_LIMIT;

  return (
    <div
      className="min-w-0 px-4 py-4 sm:px-5 sm:py-5"
      style={{ backgroundColor: "rgba(7, 32, 51, 0.72)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-[11px] uppercase tracking-[0.13em] text-[#CBE0EE]">
          <span className="font-mono">{title}</span>
        </h3>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#9CC6E0]">
          {items.length > 0 ? `${formatId(items.length)} ${unitLabel}` : `0 ${unitLabel}`}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-[13px] leading-[1.6] text-[#CBE0EE]">{emptyMessage}</p>
      ) : (
        <>
          <ol className="mt-3.5 space-y-2.5">
            {visibleItems.map(({ name, count }) => {
              const pct = maxCount > 0 ? Math.max(0, Math.min(100, (count / maxCount) * 100)) : 0;
              return (
                <li key={name} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 break-words text-[13px] font-medium leading-snug text-white sm:text-[13.5px]">
                      {name}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-white sm:text-[13.5px]">
                      <LiveNumber value={count} active={active} />
                      <span className="sr-only"> pengguna</span>
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-[3px] w-full overflow-hidden"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.12)" }}
                    aria-hidden="true"
                  >
                    <div
                      className="h-full bg-[#7DD3FC] motion-safe:transition-[width] motion-safe:duration-700"
                      style={{
                        width: `${active ? pct : 0}%`,
                        minWidth: active && pct > 0 ? "6px" : "0px",
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>

          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              className="mt-3.5 inline-flex min-h-[44px] items-center rounded-[6px] border-[1px] border-white/25 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#E2F1FA] transition-colors hover:border-[#7DD3FC] hover:bg-white/10 hover:text-white active:bg-white/15 focus-visible:outline-[#7DD3FC]"
            >
              {expanded
                ? "Tampilkan lebih sedikit"
                : `Lihat semua ${unitLabel} (${formatId(items.length)})`}
            </button>
          ) : null}
        </>
      )}
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
  const { data, loading, error, reload } = useApi<PublicStats>("/v1/stats", {
    refreshMs: 15_000,
    ttlMs: 15_000,
  });
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridSeen, setGridSeen] = useState(false);
  const hasGrid = Boolean(githubStats || data);

  useEffect(() => {
    if (!hasGrid || gridSeen) return;
    const node = gridRef.current;
    if (!node) return;
    if (node.getBoundingClientRect().top < window.innerHeight * 0.98) {
      setGridSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight) {
          setGridSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [gridSeen, hasGrid]);

  const totalUsers = useMonotonic("users", data?.users?.total_all_time);
  const totalRequests = useMonotonic("requests", data?.requests?.total_all_time);
  const branches = normalizeBreakdown(data?.branches);
  const programs = normalizeBreakdown(data?.programs);

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
                className="text-white underline underline-offset-4 hover:text-[#7DD3FC] focus-visible:outline-[#7DD3FC]"
              >
                github.com/MuaraAI/Mira
              </a>{" "}
              dan server Mira.
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delayMs={80}>
          {githubStats || data ? (
            <div
              ref={gridRef}
              className="mt-6 flex flex-col gap-[1px] overflow-hidden rounded-[10px] border-[1px] border-white/15"
              style={{ backgroundColor: "rgba(255, 255, 255, 0.14)" }}
            >
              <dl
                className={`grid grid-cols-2 gap-[1px] ${
                  githubStats && !data ? "md:grid-cols-3" : "md:grid-cols-4"
                }`}
              >
                {githubStats ? (
                  <>
                    <StatItem label="Bintang GitHub" value={githubStats.stars} active={gridSeen} />
                    <StatItem label="Fork" value={githubStats.forks} active={gridSeen} />
                    <StatItem
                      label="Kontributor"
                      value={githubStats.contributors ?? undefined}
                      active={gridSeen}
                    />
                  </>
                ) : null}
                {data ? (
                  <>
                    <StatItem label="Total pengguna" value={totalUsers} active={gridSeen} />
                    <StatItem label="Aktif 24 jam" value={data.users?.active_24h} active={gridSeen} />
                    <StatItem label="Sedang online" value={data.users?.online_now} active={gridSeen} />
                    <StatItem label="Total request" value={totalRequests} active={gridSeen} />
                    <StatItem
                      label="Request 24 jam"
                      value={data.requests?.total_24h}
                      active={gridSeen}
                    />
                  </>
                ) : null}
              </dl>

              {data ? (
                <div className="grid grid-cols-1 gap-[1px] sm:grid-cols-2">
                  <BreakdownPanel
                    title="Cabang UBSI"
                    unitLabel="cabang"
                    items={branches}
                    emptyMessage="Belum ada data sebaran cabang yang tercatat."
                    active={gridSeen}
                  />
                  <BreakdownPanel
                    title="Program studi"
                    unitLabel="prodi"
                    items={programs}
                    emptyMessage="Belum ada data sebaran program studi yang tercatat."
                    active={gridSeen}
                  />
                </div>
              ) : loading ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="px-4 py-3.5 text-[13px] leading-[1.6] text-[#CBE0EE] sm:px-5 sm:py-4"
                  style={{ backgroundColor: "rgba(7, 32, 51, 0.72)" }}
                >
                  Memuat statistik pengguna, cabang UBSI, dan program studi dari server Mira...
                </div>
              ) : error ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-[13px] leading-[1.6] text-[#CBE0EE] sm:px-5 sm:py-4"
                  style={{ backgroundColor: "rgba(7, 32, 51, 0.72)" }}
                >
                  <span>Statistik server Mira gagal dimuat.</span>
                  <button
                    type="button"
                    onClick={reload}
                    className="inline-flex min-h-[44px] items-center rounded-[6px] border-[1px] border-[#38BDF8] bg-[#0369A1] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#075985] active:bg-[#0C4A6E] focus-visible:outline-[#7DD3FC]"
                  >
                    Coba muat ulang
                  </button>
                </div>
              ) : null}
            </div>
          ) : loading ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 rounded-[10px] border-[1px] border-white/20 p-4 text-[13.5px] leading-[1.65] tracking-[0.012em] text-[#CBE0EE]"
              style={{ backgroundColor: "rgba(7, 32, 51, 0.78)" }}
            >
              Memuat statistik dari GitHub dan server Mira...
            </div>
          ) : (
            <div
              role="alert"
              className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border-[1px] border-white/20 p-4 text-[13.5px] leading-[1.65] tracking-[0.012em] text-[#CBE0EE]"
              style={{ backgroundColor: "rgba(7, 32, 51, 0.78)" }}
            >
              <span>
                {error
                  ? "Statistik server Mira gagal dimuat."
                  : "Statistik belum tersedia saat ini."}
              </span>
              <button
                type="button"
                onClick={reload}
                className="inline-flex min-h-[44px] items-center rounded-[6px] border-[1px] border-[#38BDF8] bg-[#0369A1] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#075985] active:bg-[#0C4A6E] focus-visible:outline-[#7DD3FC]"
              >
                Coba muat ulang
              </button>
            </div>
          )}
        </RevealOnScroll>
      </div>
    </section>
  );
}
