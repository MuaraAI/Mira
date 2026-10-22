"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  UserCheck,
  Ellipsis,
  BellRing,
  X,
} from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Monogram } from "@/components/Monogram";
import { FocusDialog } from "@/components/FocusDialog";

export function DashboardMobileNav({ nim }: { nim?: string | null }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Close drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const quickNav = [
    { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/jadwal", label: "Jadwal", icon: CalendarDays },
    { href: "/dashboard/tugas", label: "Tugas", icon: CheckSquare },
    { href: "/dashboard/presensi", label: "Presensi", icon: UserCheck },
  ];
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
  // "Lainnya" menyala saat halaman aktif bukan salah satu tab cepat, supaya posisi pengguna tetap jelas.
  const moreActive = !quickNav.some(({ href, exact }) => isActive(href, exact));
  const itemBase =
    "relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 font-mono text-[10px] leading-tight transition-colors duration-200";

  return (
    <>
      {/* Mobile Topbar */}
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center justify-between px-4 bg-white/90 backdrop-blur-xl border-b-2 border-px-soft">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="px-frame flex h-8 w-8 items-center justify-center overflow-hidden bg-white [--px-line:#CFE2EE]">
            <Monogram className="w-6 h-6" />
          </span>
          <div className="flex flex-col">
            <span className="font-display font-bold text-sm tracking-tight text-foreground">
              UBSI API
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/notifikasi"
          aria-label="Buka pengaturan notifikasi"
          aria-current={pathname.startsWith("/dashboard/notifikasi") ? "page" : undefined}
          className="px-frame flex min-h-[44px] min-w-[44px] items-center justify-center bg-white text-foreground [--px-line:#CFE2EE] hover:bg-px-tint"
        >
          <BellRing className="h-5 w-5" aria-hidden="true" />
        </Link>
      </header>

      {/* Mobile Drawer (Slide-Over) */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="modal-backdrop fixed inset-0 bg-[#072033]/50 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <FocusDialog
            open={isOpen}
            onClose={() => setIsOpen(false)}
            className="drawer-panel relative flex flex-col w-4/5 max-w-xs h-full bg-white shadow-[6px_0_0_0_#0369A1] z-10"
          >
            {/* Close Button Header */}
            <div className="flex items-center justify-between p-3 border-b-2 border-px-soft bg-px-tint">
              <span className="font-display font-bold text-sm text-foreground">
                Navigasi Menu
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup menu"
                className="px-frame min-w-[44px] min-h-[44px] flex items-center justify-center bg-white text-secondary [--px-line:#CFE2EE] hover:text-foreground"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Sidebar View inside Drawer */}
            <div className="flex-1 overflow-hidden">
              <DashboardSidebar nim={nim} onItemClick={() => setIsOpen(false)} />
            </div>
          </FocusDialog>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi cepat bawah"
        className="dashboard-bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t-2 border-[#163A55] bg-white px-1 shadow-[0_-4px_0_0_#CFE2EE]"
      >
        {quickNav.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`${itemBase} ${active ? "font-bold text-[#0369A1]" : "text-secondary hover:text-foreground"}`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-x-3 top-0 h-[3px] transition-colors ${active ? "bg-[#0369A1]" : "bg-transparent"}`}
              />
              <span className={`flex h-7 w-12 items-center justify-center transition-colors ${active ? "bg-px-highlight" : ""}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`${itemBase} ${moreActive ? "font-bold text-[#0369A1]" : "text-secondary hover:text-foreground"}`}
        >
          <span
            aria-hidden="true"
            className={`absolute inset-x-3 top-0 h-[3px] transition-colors ${moreActive ? "bg-[#0369A1]" : "bg-transparent"}`}
          />
          <span className={`flex h-7 w-12 items-center justify-center transition-colors ${moreActive ? "bg-px-highlight" : ""}`}>
            <Ellipsis className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>Lainnya</span>
        </button>
      </nav>
    </>
  );
}
