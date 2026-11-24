"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  UserCheck,
  BookOpen,
  GraduationCap,
  FileSpreadsheet,
  Award,
  Newspaper,
  Megaphone,
  Library,
  KeyRound,
  BellRing,
  ShieldCheck,
  HelpCircle,
  MessageSquare,
  Repeat,
  MessagesSquare,
  LogOut,
  ArrowLeft,
  PanelLeftOpen,
} from "lucide-react";
import { Monogram } from "@/components/Monogram";
import { Avatar } from "@/components/social/Avatar";
import type { SocialProfile } from "@/lib/social";
import { useLogout } from "@/lib/logout";

export interface NavGroup {
  title: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
    exact?: boolean;
    badge?: string;
  }[];
}

export const DASHBOARD_NAV_GROUPS: NavGroup[] = [
  {
    title: "Utama",
    items: [
      { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/komunitas", label: "Komunitas", icon: MessagesSquare, badge: "Baru" },
    ],
  },
  {
    title: "Perkuliahan",
    items: [
      { href: "/dashboard/jadwal", label: "Jadwal Kuliah", icon: CalendarDays },
      { href: "/dashboard/tugas", label: "Tugas Kuliah", icon: CheckSquare },
      { href: "/dashboard/presensi", label: "Presensi Kehadiran", icon: UserCheck },
      { href: "/dashboard/pengganti", label: "Kuliah Pengganti", icon: Repeat },
      { href: "/dashboard/materi", label: "Bahan Ajar", icon: BookOpen },
      { href: "/dashboard/kuis", label: "Kuis Perkuliahan", icon: HelpCircle },
      { href: "/dashboard/diskusi", label: "Forum Diskusi", icon: MessageSquare },
    ],
  },
  {
    title: "Akademik",
    items: [
      { href: "/dashboard/nilai", label: "Nilai & KHS", icon: GraduationCap },
      { href: "/dashboard/krs", label: "Kartu KRS", icon: FileSpreadsheet },
      { href: "/dashboard/ujian", label: "Kartu Ujian", icon: Award },
    ],
  },
  {
    title: "Layanan Kampus",
    items: [
      { href: "/dashboard/agenda", label: "Info Kampus", icon: Megaphone, badge: "Live" },
      { href: "/dashboard/berita", label: "Berita Kampus", icon: Newspaper },
      { href: "/dashboard/perpustakaan", label: "Perpustakaan OPAC", icon: Library },
    ],
  },
  {
    title: "Pengaturan & Integrasi",
    items: [
      { href: "/dashboard/keys", label: "Personal API Keys", icon: KeyRound },
      { href: "/dashboard/notifikasi", label: "Notifikasi Webhook", icon: BellRing },
      { href: "/dashboard/sesi", label: "Sesi & Keamanan", icon: ShieldCheck },
    ],
  },
];

export const SIAKAD_REQUIRED_PATHS = new Set([
  "/dashboard/nilai",
  "/dashboard/krs",
]);

export function DashboardSidebar({
  nim,
  profile = null,
  hasSiakad = true,
  onItemClick,
  showBrand = true,
  hideHrefs = [],
  compact = false,
  inDrawer = false,
  onToggleCompact,
}: {
  nim?: string | null;
  profile?: SocialProfile | null;
  hasSiakad?: boolean;
  onItemClick?: () => void;
  /** Hanya ikon (lebar 64px), dipakai halaman Komunitas agar area chat lebih lega. */
  compact?: boolean;
  /** Ditampilkan di drawer mobile (topbar desktop tidak ada, jadi Beranda & Keluar tampil di sini). */
  inDrawer?: boolean;
  onToggleCompact?: () => void;
  /** Drawer mobile sudah punya header sendiri, jadi brand di sini disembunyikan. */
  showBrand?: boolean;
  /** Menu yang sudah ada di navbar bawah tidak perlu diulang di drawer "Lainnya". */
  hideHrefs?: string[];
}) {
  const pathname = usePathname();
  const groups = DASHBOARD_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !hideHrefs.includes(item.href)),
  })).filter((group) => group.items.length > 0);
  const { logout, busy } = useLogout();
  const displayName = profile?.display_name?.trim() || (nim ? `Mahasiswa ${nim.slice(-4)}` : "Mahasiswa");
  const subIdentity = profile?.username
    ? `@${profile.username}${nim ? ` · ${nim}` : ""}`
    : nim || "-";
  const avatarSeed = profile?.username || nim || "mira";

  return (
    <aside className="flex h-full flex-col bg-white/95 backdrop-blur-md lg:border-r-[1px] lg:border-stroke">
      {showBrand && (
        <div
          className={`flex h-16 shrink-0 items-center border-b-[1px] border-stroke ${
            compact ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          {compact && onToggleCompact ? (
            <button
              type="button"
              onClick={onToggleCompact}
              title="Buka sidebar menu"
              aria-label="Buka sidebar menu"
              className="group flex h-10 w-10 items-center justify-center rounded-[8px] transition-colors hover:bg-[#F0F7FB]"
            >
              <PanelLeftOpen className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
            </button>
          ) : (
            <Link href="/dashboard" onClick={onItemClick} className="group flex items-center gap-2.5">
              <Monogram className="h-8 w-8 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <span className="flex flex-col leading-none">
                <span className="font-home-display text-base tracking-[0.04em] text-foreground">
                  Mira
                </span>
                <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[#0369A1]">
                  Muara AI
                </span>
              </span>
            </Link>
          )}
        </div>
      )}

      <nav
        aria-label="Navigasi sidebar utama"
        className={`scroll-slim flex-1 space-y-4 overflow-y-auto py-3 ${compact ? "px-2" : "px-3"}`}
      >
        {groups.map((group) => (
          <div key={group.title}>
            {group.items.length > 1 && !compact && (
              <p className="mb-1 px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-secondary/75">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                const isLocked = !hasSiakad && SIAKAD_REQUIRED_PATHS.has(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onItemClick}
                      aria-current={active ? "page" : undefined}
                      title={compact ? (isLocked ? `${label} (butuh SIAKAD)` : label) : undefined}
                      className={`flex min-h-[42px] items-center gap-2.5 text-[13px] transition-colors lg:min-h-[36px] ${
                        compact ? "justify-center rounded-[6px] px-0" : "px-2.5"
                      } ${
                        active
                          ? "rounded-r-[6px] rounded-l-none border-l-[2px] border-[#0369A1] bg-[#F0F7FB]/80 text-foreground"
                          : "rounded-[6px] text-secondary hover:bg-[#F0F7FB] hover:text-foreground"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active
                            ? "text-[#0369A1]"
                            : isLocked
                              ? "text-amber-600"
                              : "text-secondary"
                        }`}
                        aria-hidden="true"
                      />
                      <span className={compact ? "sr-only" : "truncate"}>{label}</span>
                      {isLocked && !compact && (
                        <span className="ml-auto font-mono text-[10px] text-amber-700">
                          Kunci
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={`shrink-0 space-y-2 border-t-[1px] border-stroke ${compact ? "p-2" : "p-3"}`}>
        {inDrawer && (
          <Link
            href="/"
            onClick={onItemClick}
            className="flex min-h-[40px] items-center gap-2 rounded-[6px] border-[1px] border-stroke bg-white px-3 text-[12.5px] text-secondary transition-colors hover:border-[#072033] hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Kembali ke Beranda</span>
          </Link>
        )}

        <div className={`flex items-center gap-2 ${compact ? "flex-col" : ""}`}>
          <Link
            href="/dashboard/sesi"
            onClick={onItemClick}
            title={compact ? `${displayName} (${subIdentity})` : "Profil & Sesi"}
            className={`group flex min-h-11 min-w-0 items-center gap-2.5 rounded-[8px] py-1.5 transition-colors hover:bg-[#F0F7FB] ${
              compact ? "justify-center px-0" : "flex-1 px-2"
            }`}
          >
            <Avatar
              name={displayName}
              seed={avatarSeed}
              src={profile?.avatar}
              size="sm"
              online={profile ? true : undefined}
            />
            <span className={compact ? "sr-only" : "flex min-w-0 flex-col"}>
              <span className="truncate text-[13px] font-medium leading-tight text-foreground group-hover:text-[#0369A1]">
                {displayName}
              </span>
              <span className="mt-0.5 truncate font-mono text-[10.5px] text-secondary">
                {subIdentity}
              </span>
            </span>
          </Link>
          {inDrawer && (
            <button
              type="button"
              onClick={() => logout("device")}
              disabled={busy !== null}
              aria-label="Keluar dari Mira"
              title="Keluar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border-[1px] border-[#FDA4AF] bg-white text-[#BE123C] transition-colors hover:bg-[#FFF1F2] disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
