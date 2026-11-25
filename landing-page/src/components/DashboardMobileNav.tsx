"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  MessagesSquare,
  Ellipsis,
  BellRing,
  X,
} from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Monogram } from "@/components/Monogram";
import { FocusDialog } from "@/components/FocusDialog";
import { lockScroll } from "@/lib/scroll-lock";
import { DashboardHeaderActions } from "@/components/DashboardHeaderActions";
import type { SocialProfile } from "@/lib/social";

export function DashboardMobileNav({
  nim,
  profile = null,
  hasSiakad = true,
}: {
  nim?: string | null;
  profile?: SocialProfile | null;
  hasSiakad?: boolean;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    return lockScroll();
  }, [isOpen]);

  const quickNav = [
    { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/jadwal", label: "Jadwal", icon: CalendarDays },
    { href: "/dashboard/tugas", label: "Tugas", icon: CheckSquare },
    { href: "/dashboard/komunitas", label: "Komunitas", icon: MessagesSquare },
  ];
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);
  const moreActive = !quickNav.some(({ href, exact }) => isActive(href, exact));

  return (
    <>
      {/* Mobile Topbar */}
      <header className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b-[1px] border-stroke bg-white/95 px-3.5 backdrop-blur-md lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Monogram className="h-7 w-7 shrink-0" />
          <span className="font-home-display text-sm tracking-[0.04em] text-foreground">Mira</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <DashboardHeaderActions compact />
          <Link
            href="/dashboard/notifikasi"
            aria-label="Buka pengaturan notifikasi"
            aria-current={pathname.startsWith("/dashboard/notifikasi") ? "page" : undefined}
            className="flex h-9 w-9 items-center justify-center rounded-[8px] text-secondary transition-colors hover:bg-[#F0F7FB] hover:text-foreground"
          >
            <BellRing className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Mobile Drawer (Slide-Over) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="modal-backdrop fixed inset-0 bg-[#072033]/50"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <FocusDialog
            open={isOpen}
            onClose={() => setIsOpen(false)}
            labelledBy="drawer-title"
            className="drawer-panel relative z-10 flex h-full w-[82%] max-w-[300px] flex-col overflow-hidden rounded-r-[12px] bg-white shadow-2xl"
          >
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b-[1px] border-stroke pl-4 pr-2">
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5"
              >
                <Monogram className="h-6 w-6" />
                <span id="drawer-title" className="font-home-display text-sm text-foreground">
                  Mira
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup menu"
                className="flex h-11 w-11 items-center justify-center rounded-[6px] text-secondary transition-colors hover:bg-[#F0F7FB] hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1">
              <DashboardSidebar
                nim={nim}
                profile={profile}
                hasSiakad={hasSiakad}
                showBrand={false}
                inDrawer
                hideHrefs={quickNav.map((item) => item.href)}
                onItemClick={() => setIsOpen(false)}
              />
            </div>
          </FocusDialog>
        </div>
      )}

      {/* Edge-to-edge Mobile Bottom Navigation */}
      <nav
        aria-label="Navigasi cepat bawah"
        className="dashboard-bottom-nav fixed inset-x-0 bottom-0 z-40 lg:hidden"
      >
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
            <span className="bottom-nav-label">Menu</span>
          </button>
        </div>
      </nav>
    </>
  );
}
