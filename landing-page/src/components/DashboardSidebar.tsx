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
} from "lucide-react";
import { Monogram } from "@/components/Monogram";

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
    ],
  },
  {
    title: "Perkuliahan",
    items: [
      { href: "/dashboard/jadwal", label: "Jadwal Kuliah", icon: CalendarDays },
      { href: "/dashboard/tugas", label: "Tugas Kuliah", icon: CheckSquare },
      { href: "/dashboard/presensi", label: "Presensi Kehadiran", icon: UserCheck },
      { href: "/dashboard/materi", label: "Bahan Ajar", icon: BookOpen },
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
    title: "Pengaturan & Dev",
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
}: {
  nim?: string | null;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col h-full bg-white border-r border-stroke">
      {/* Brand Header */}
      <div className="p-5 border-b border-stroke">
        <Link
          href="/dashboard"
          onClick={onItemClick}
          className="flex items-center gap-3 group"
        >
          <Monogram className="w-8 h-8 transition-transform duration-200 group-hover:scale-105" />
          <div className="flex flex-col">
            <span className="font-display font-bold text-base tracking-tight text-foreground">
              UBSI API
            </span>
            <span className="text-[10px] font-mono tracking-widest text-[#0369A1] font-bold uppercase -mt-0.5">
              Command Center
            </span>
          </div>
        </Link>
      </div>

      {/* Nav List with Custom Scrollbar */}
      <nav
        aria-label="Navigasi sidebar utama"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
      >
        {DASHBOARD_NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-secondary font-bold">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map(({ href, label, icon: Icon, exact, badge }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onItemClick}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-sm text-xs sm:text-sm font-medium transition-colors duration-150 ${
                        active
                          ? "bg-[#0369A1] text-white font-semibold shadow-sm"
                          : "text-secondary hover:text-foreground hover:bg-[#F0F7FB]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            active ? "text-white" : "text-[#0369A1]"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{label}</span>
                      </div>
                      {badge && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                            active
                              ? "bg-white/20 text-white"
                              : "bg-[#0369A1]/10 text-[#0369A1]"
                          }`}
                        >
                          {badge}
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

      {/* Footer Info */}
      <div className="p-4 border-t border-stroke bg-[#F7FAFC]">
        <div className="flex items-center justify-between text-xs">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-mono uppercase text-secondary font-bold">
              Mahasiswa
            </span>
            <span className="font-mono font-semibold text-foreground truncate">
              {nim ?? "-"}
            </span>
          </div>
          <Link
            href="/dashboard/sesi"
            onClick={onItemClick}
            className="text-[11px] font-semibold text-[#0369A1] hover:underline shrink-0"
          >
            Info Sesi
          </Link>
        </div>
      </div>
    </aside>
  );
}
