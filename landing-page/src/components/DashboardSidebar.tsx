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
  Library,
  KeyRound,
  BellRing,
  ShieldCheck,
  HelpCircle,
  MessageSquare,
  MessagesSquare,
  LogOut,
} from "lucide-react";
import { Monogram } from "@/components/Monogram";
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

export function DashboardSidebar({
  nim,
  onItemClick,
  showBrand = true,
  hideHrefs = [],
}: {
  nim?: string | null;
  onItemClick?: () => void;
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

  return (
    <aside className="flex h-full flex-col bg-white lg:border-r-2 lg:border-px-soft">
      {showBrand && (
        <div className="flex h-16 shrink-0 items-center border-b-2 border-px-soft px-4">
          <Link href="/dashboard" onClick={onItemClick} className="group flex items-center gap-2.5">
            <span className="px-frame flex h-9 w-9 items-center justify-center overflow-hidden bg-white [--px-line:#CFE2EE]">
              <Monogram className="h-7 w-7 transition-transform duration-200 group-hover:scale-110" />
            </span>
            <span className="flex flex-col">
              <span className="font-display text-base font-bold leading-none tracking-tight text-foreground">Mira</span>
              <span className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#0369A1]">Muara AI</span>
            </span>
          </Link>
        </div>
      )}

      <nav aria-label="Navigasi sidebar utama" className="scroll-slim flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {groups.map((group) => (
          <div key={group.title}>
            {group.items.length > 1 && (
              <p className="mb-0.5 flex items-center gap-2 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-secondary/80">
                <span className="h-1.5 w-1.5 bg-px-water" aria-hidden="true" />
                {group.title}
              </p>
            )}
            <ul className="space-y-px">
              {group.items.map(({ href, label, icon: Icon, exact, badge }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onItemClick}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-2.5 px-2.5 font-mono text-xs transition-[background-color,color,box-shadow] duration-200 lg:min-h-8 ${
                        active
                          ? "bg-px-highlight font-semibold text-foreground shadow-[inset_3px_0_0_#0369A1]"
                          : "font-medium text-secondary hover:bg-[#F0F7FB] hover:text-foreground hover:shadow-[inset_3px_0_0_#9CC6E0]"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#0369A1]" : "text-secondary"}`} aria-hidden="true" />
                      <span className="truncate">{label}</span>
                      {badge && (
                        <span className="px-chip ml-auto bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#0369A1]">{badge}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t-2 border-px-soft p-3">
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/sesi"
            onClick={onItemClick}
            className="group flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 transition-colors hover:bg-[#F0F7FB]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#072033] font-mono text-[11px] font-bold text-white shadow-[2px_2px_0_0_#0369A1]">
              {(nim ?? "").slice(-2) || "--"}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-secondary">
                <span className="h-1.5 w-1.5 bg-[#0F766E]" aria-hidden="true" />
                Mahasiswa
              </span>
              <span className="truncate font-mono text-xs font-semibold text-foreground group-hover:text-[#0369A1]">{nim ?? "-"}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => logout("device")}
            disabled={busy !== null}
            aria-label="Keluar dari Mira"
            title="Keluar"
            className="px-frame flex h-11 w-11 shrink-0 items-center justify-center bg-white text-[#BE123C] [--px-line:#FDA4AF] hover:bg-[#FFF1F2] disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
