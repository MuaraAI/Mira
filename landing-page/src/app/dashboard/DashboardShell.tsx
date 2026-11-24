"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRequireSession } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/dashboard-ui";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DashboardMobileNav } from "@/components/DashboardMobileNav";
import { MuaraBackdrop } from "@/components/MuaraBackdrop";
import { SOCIAL_PROFILES } from "@/components/SocialIcons";
import PwaPushBanner from "@/components/PwaPushBanner";
import { DefaultPasswordBanner, LoginTodayBadge } from "@/components/SecurityWidgets";
import { DialogProvider } from "@/components/ConfirmDialog";
import { MaintenanceContent } from "@/components/MaintenanceContent";
import { useMaintenance } from "@/lib/maintenance";
import { useLogout } from "@/lib/logout";
import { useMySocialProfile } from "@/lib/social";

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
    case "/dashboard/pengganti":
      return "Kuliah Pengganti";
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
      return "Jadwal & Kartu Ujian";
    case "/dashboard/agenda":
      return "Info Kampus";
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

function MaintenanceScreen({ message, reason }: { message: string; reason: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-10">
      <MaintenanceContent message={message} reason={reason} />
    </div>
  );
}

function ShellLayout({ children }: { children: React.ReactNode }) {
  const { status: maintenance } = useMaintenance();
  const pathname = usePathname();
  const { logout, busy } = useLogout();
  const { authed, checking, error, reload, nim, hasSiakad } = useRequireSession();
  const socialProfile = useMySocialProfile(authed);
  const title = getPageTitle(pathname);
  const chatRoute = pathname.startsWith("/dashboard/komunitas");
  const examRoute = pathname.startsWith("/dashboard/kuis/room");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(chatRoute);

  useEffect(() => {
    setSidebarCollapsed(chatRoute);
  }, [chatRoute]);

  if (examRoute) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <div className="mira-portal relative flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      {!chatRoute && <MuaraBackdrop />}

      {/* Desktop Sidebar (lg breakpoint >= 1024px) */}
      <div
        className={`hidden transition-[width] duration-200 lg:fixed lg:inset-y-0 lg:z-30 lg:block ${
          sidebarCollapsed ? "lg:w-16" : "lg:w-64"
        }`}
      >
        <DashboardSidebar
          nim={nim}
          profile={socialProfile}
          hasSiakad={hasSiakad}
          compact={sidebarCollapsed}
          onToggleCompact={() => setSidebarCollapsed((v) => !v)}
        />
      </div>

      {/* Mobile Navigation (Topbar, Bottom dock & Drawer) */}
      <DashboardMobileNav nim={nim} profile={socialProfile} hasSiakad={hasSiakad} authed={authed} />

      {/* Main Content Area */}
      <div
        className={`relative z-10 flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ${
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
        }`}
      >
        {/* Desktop Sticky Subheader */}
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b-[1px] border-stroke bg-white/90 px-6 backdrop-blur-md lg:flex">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? "Buka sidebar menu" : "Perkecil sidebar menu"}
              title={sidebarCollapsed ? "Buka sidebar" : "Perkecil sidebar"}
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border-[1px] border-stroke bg-white px-2.5 text-xs text-secondary transition-colors hover:border-[#072033] hover:text-foreground"
            >
              {sidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                  <span>Menu</span>
                </>
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <div className="flex items-center gap-2 font-mono text-xs">
              <Link
                href="/dashboard"
                className="text-[#0369A1] transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <span className="text-px-water" aria-hidden="true">
                /
              </span>
              <span className="text-foreground">{title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {authed && <LoginTodayBadge />}

            <div className="flex items-center gap-0.5" aria-label="Follow media sosial Mira">
              {SOCIAL_PROFILES.map(({ id, name, handle, href, icon: Icon }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow ${name} ${handle}`}
                  title={`Follow ${name} (${handle})`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-secondary transition-colors hover:bg-[#EAF3F9] hover:text-[#072033]"
                >
                  <Icon className="h-[15px] w-[15px]" />
                </a>
              ))}
            </div>

            <span className="h-4 w-[1px] bg-stroke" aria-hidden="true" />

            <Link
              href="/"
              className="flex h-9 items-center gap-1.5 rounded-[6px] border-[1px] border-stroke bg-white px-3 text-xs text-secondary transition-colors hover:border-[#072033] hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Beranda</span>
            </Link>

            <button
              type="button"
              onClick={() => logout("device")}
              disabled={busy !== null}
              className="flex h-9 items-center gap-2 rounded-[6px] border-[1px] border-[#FDA4AF] bg-white px-3.5 text-xs text-[#BE123C] transition-colors hover:bg-[#FFF1F2] disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{busy ? "Keluar..." : "Keluar"}</span>
            </button>
          </div>
        </header>

        <main
          id="main-content"
          className={
            chatRoute
              ? "min-w-0 w-full flex-1 overflow-x-clip px-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 lg:px-6 lg:py-3"
              : "dashboard-main mx-auto min-w-0 w-full max-w-6xl flex-1 overflow-x-clip px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8 lg:pb-10"
          }
        >
          {checking ? (
            <LoadingState label="Memeriksa sesi mahasiswa" />
          ) : error?.code === "MAINTENANCE" ? (
            <MaintenanceScreen
              message={maintenance?.message ?? "Mira sedang maintenance."}
              reason={maintenance?.reason ?? ""}
            />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : authed ? (
            <div key={pathname} className="page-in min-w-0">
              {!chatRoute && <DefaultPasswordBanner />}
              {!chatRoute && <PwaPushBanner />}
              {children}
            </div>
          ) : null}
        </main>

        <footer
          className={`hidden border-t-[1px] border-stroke px-6 py-4 text-center font-mono text-[11px] text-secondary ${
            chatRoute ? "" : "lg:block"
          }`}
        >
          Mira bukan aplikasi resmi UBSI. Data diambil dari MyBest dan portal kampus.
        </footer>
      </div>
    </div>
  );
}
