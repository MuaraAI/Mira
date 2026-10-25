"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, LogOut } from "lucide-react";
import { useRequireSession } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/dashboard-ui";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DashboardMobileNav } from "@/components/DashboardMobileNav";
import PwaPushBanner from "@/components/PwaPushBanner";
import { DialogProvider } from "@/components/ConfirmDialog";
import { useLogout } from "@/lib/logout";

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
    case "/dashboard/kuis":
      return "Kuis Perkuliahan";
    case "/dashboard/komunitas":
      return "Komunitas";
    case "/dashboard/diskusi":
      return "Forum Diskusi Perkuliahan";
    case "/dashboard/nilai":
      return "Nilai & KHS";
    case "/dashboard/flexing":
      return "Flexing Nilai";
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

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DialogProvider>
      <ShellLayout>{children}</ShellLayout>
    </DialogProvider>
  );
}

function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, busy } = useLogout();
  const { authed, checking, error, reload, nim } = useRequireSession();
  const title = getPageTitle(pathname);
  // Komunitas adalah aplikasi chat: pakai lebar penuh dan tinggi layar, tanpa banner dan footer.
  const chatRoute = pathname.startsWith("/dashboard/komunitas");

  return (
    <div className="portal-type min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
      {/* Desktop Sidebar (lg breakpoint >= 1024px) */}
      <div className="hidden lg:block lg:w-64 lg:fixed lg:inset-y-0 lg:z-30">
        <DashboardSidebar nim={nim} />
      </div>

      {/* Mobile Navigation (Topbar, Bottom bar & Drawer) */}
      <DashboardMobileNav nim={nim} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Desktop Sticky Subheader */}
        <header className="hidden lg:flex sticky top-0 z-20 h-16 items-center justify-between px-8 bg-white/85 backdrop-blur-xl border-b-2 border-px-soft">
          <div className="flex items-center gap-2 font-mono text-xs">
            <Link
              href="/dashboard"
              className="font-semibold text-[#0369A1] transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
            <span className="text-px-water" aria-hidden="true">/</span>
            <span className="font-semibold text-foreground">{title}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-chip flex items-center gap-1.5 px-2.5 py-1 bg-[#F0F7FB] text-[11px] font-mono text-[#0369A1] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0369A1]" aria-hidden="true" />
              <span>Sesi aktif</span>
            </div>

            <button
              type="button"
              onClick={() => logout("device")}
              disabled={busy !== null}
              className="px-frame flex h-10 items-center gap-2 bg-white px-3.5 font-mono text-xs font-bold text-[#BE123C] transition-colors [--px-line:#FDA4AF] hover:bg-[#FFF1F2] disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{busy ? "Keluar..." : "Keluar"}</span>
            </button>
          </div>
        </header>

        <main
          id="main-content"
          className={
            chatRoute
              ? "flex-1 w-full px-2 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4 lg:px-6 lg:py-3"
              : "dashboard-main flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8"
          }
        >
          {checking ? (
            <LoadingState label="Memeriksa sesi mahasiswa" />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : authed ? (
            <div key={pathname} className="page-in">
              {!chatRoute && <PwaPushBanner />}
              {children}
            </div>
          ) : null}
        </main>

        <footer className={`py-4 px-6 text-center font-mono text-[11px] text-secondary border-t-2 border-dashed border-px-soft hidden ${chatRoute ? "" : "lg:block"}`}>
          Mira bukan aplikasi resmi UBSI. Data diambil dari SIAKAD dan MyBest.
        </footer>
      </div>
    </div>
  );
}
