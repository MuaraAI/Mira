"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, Newspaper, BellRing, UserRound, KeyRound } from "lucide-react";
import { useRequireSession } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/dashboard-ui";
import { Monogram } from "@/components/Monogram";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/jadwal", label: "Jadwal", icon: CalendarDays, exact: false },
  { href: "/dashboard/berita", label: "Berita", icon: Newspaper, exact: false },
  { href: "/dashboard/notifikasi", label: "Notifikasi", icon: BellRing, exact: false },
  { href: "/dashboard/keys", label: "API Keys", icon: KeyRound, exact: false },
  { href: "/dashboard/sesi", label: "Sesi", icon: UserRound, exact: false },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { authed, checking, error, reload } = useRequireSession();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-accent/25">
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-blob ambient-blob-1" />
        <div className="ambient-blob ambient-blob-2" />
      </div>
      <div className="grid-overlay" aria-hidden="true" />

      <header className="sticky top-0 z-50 w-full py-3 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto glass-pill px-4 sm:px-5 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Monogram className="w-7 h-7" />
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm sm:text-base tracking-tight text-foreground">
                UBSI API
              </span>
              <span className="text-[10px] font-mono tracking-widest text-[#0369A1] font-bold uppercase -mt-0.5">
                Dashboard Mahasiswa
              </span>
            </div>
          </Link>

          <nav aria-label="Navigasi dashboard" className="-mx-1 overflow-x-auto">
            <ul className="flex items-center gap-1 px-1 w-max">
              {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all duration-200 ease-glass ${
                        active
                          ? "bg-[#072033] text-white border border-white/25"
                          : "text-secondary hover:text-foreground border border-transparent"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {checking ? (
          <LoadingState label="Memeriksa sesi login" />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : authed ? (
          children
        ) : null}
      </main>

      <footer className="py-6 px-4 text-center">
        <p className="text-xs text-secondary">
          UBSI API Dashboard. Data bersumber dari SIAKAD, MyBest, dan portal resmi kampus.
        </p>
      </footer>
    </div>
  );
}
