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
import { lockScroll } from "@/lib/scroll-lock";

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

  // Kunci scroll halaman selagi drawer terbuka.
  useEffect(() => {
    if (!isOpen) return;
    return lockScroll();
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
              Mira
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
          <div
            className="modal-backdrop fixed inset-0 bg-[#072033]/50 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <FocusDialog
            open={isOpen}
            onClose={() => setIsOpen(false)}
            labelledBy="drawer-title"
            className="drawer-panel relative z-10 flex h-full w-[82%] max-w-[300px] flex-col bg-white shadow-[2px_0_0_0_#163A55,6px_0_0_0_#0369A1]"
          >
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b-2 border-px-soft pl-4 pr-2">
              <Link href="/dashboard" onClick={() => setIsOpen(false)} className="flex items-center gap-2.5">
                <span className="px-frame flex h-8 w-8 items-center justify-center overflow-hidden bg-white [--px-line:#CFE2EE]">
                  <Monogram className="h-6 w-6" />
                </span>
                <span id="drawer-title" className="font-display text-sm font-bold text-foreground">
                  Menu Mira
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup menu"
                className="flex h-11 w-11 items-center justify-center text-secondary transition-colors hover:bg-px-tint hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1">
              <DashboardSidebar
                nim={nim}
                showBrand={false}
                hideHrefs={quickNav.map((item) => item.href)}
                onItemClick={() => setIsOpen(false)}
              />
            </div>
          </FocusDialog>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav aria-label="Navigasi cepat bawah" className="dashboard-bottom-nav lg:hidden fixed inset-x-0 bottom-0 z-40">
        <div className="grid grid-cols-5">
          {quickNav.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="bottom-nav-item"
                data-active={active}
              >
                <span className="bottom-nav-icon" aria-hidden="true">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="bottom-nav-label">{label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            className="bottom-nav-item"
            data-active={moreActive || isOpen}
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              <Ellipsis className="h-[18px] w-[18px]" />
            </span>
            <span className="bottom-nav-label">Lainnya</span>
          </button>
        </div>
      </nav>
    </>
  );
}
