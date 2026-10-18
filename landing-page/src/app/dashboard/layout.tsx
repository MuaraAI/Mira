"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, LogOut } from "lucide-react";
import { useRequireSession } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/dashboard-ui";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DashboardMobileNav } from "@/components/DashboardMobileNav";

function getPageTitle(pathname: string): string {
  switch (pathname) {
    case "/dashboard":
      return "Ringkasan";
    case "/dashboard/jadwal":
      return "Jadwal Kuliah";
    case "/dashboard/tugas":
      return "Tugas & Deadline";
    case "/dashboard/presensi":
      return "Presensi Kehadiran";
    case "/dashboard/materi":
      return "Bahan Ajar & Modul";
    case "/dashboard/nilai":
      return "Nilai & KHS";
    case "/dashboard/krs":
      return "Kartu Rencana Studi (KRS)";
    case "/dashboard/ujian":
      return "Kartu Ujian UTS & UAS";
    case "/dashboard/berita":
      return "Berita Kampus";
    case "/dashboard/perpustakaan":
      return "Perpustakaan OPAC";
    case "/dashboard/keys":
      return "Personal API Keys";
    case "/dashboard/notifikasi":
      return "Notifikasi Webhook";
    case "/dashboard/sesi":
      return "Sesi & Keamanan";
    default:
      return "Dashboard";
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { authed, checking, error, reload, nim } = useRequireSession();
  const title = getPageTitle(pathname);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <div className="grid-overlay" aria-hidden="true" />

      {/* Desktop Sidebar (lg breakpoint >= 1024px) */}
      <div className="hidden lg:block lg:w-64 lg:fixed lg:inset-y-0 lg:z-30">
        <DashboardSidebar nim={nim} />
      </div>

      {/* Mobile Navigation (Topbar, Bottom bar & Drawer) */}
      <DashboardMobileNav nim={nim} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Desktop Sticky Subheader */}
        <header className="hidden lg:flex sticky top-0 z-20 items-center justify-between px-8 py-3.5 bg-white/80 backdrop-blur-md border-b border-stroke">
          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/dashboard"
              className="text-secondary hover:text-foreground font-medium"
            >
              Dashboard
            </Link>
            <span className="text-secondary/60">/</span>
            <span className="font-semibold text-foreground">{title}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-[#F0F7FB] border border-[#0369A1]/20 text-[11px] font-mono text-[#0369A1] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0369A1]" aria-hidden="true" />
              <span>Sesi Redis (AES-256)</span>
            </div>

            <Link
              href="/dashboard/sesi"
              aria-label="Pengaturan sesi dan logout"
              className="p-1.5 rounded-sm text-secondary hover:text-foreground hover:bg-[#F0F7FB] border border-stroke"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </header>

        {/* Content View */}
        <main
          id="main-content"
          className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8"
        >
          {checking ? (
            <LoadingState label="Memeriksa sesi mahasiswa" />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : authed ? (
            children
          ) : null}
        </main>

        <footer className="py-4 px-6 text-center text-xs text-secondary border-t border-stroke/60 hidden lg:block">
          UBSI API Student Command Center. Data terintegrasi dari SIAKAD, MyBest, dan portal kampus.
        </footer>
      </div>
    </div>
  );
}
