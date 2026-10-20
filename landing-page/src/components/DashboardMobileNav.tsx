"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Menu,
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
  ];

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
            <span className="text-[9px] font-mono tracking-widest text-[#0369A1] font-bold uppercase -mt-0.5">
              Command Center
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-label="Buka navigasi menu lengkap"
          className="px-frame min-w-[44px] min-h-[44px] flex items-center justify-center bg-white text-secondary [--px-line:#CFE2EE] hover:text-foreground"
        >
          <Menu className="w-5 h-5 text-foreground" aria-hidden="true" />
        </button>
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
        className="dashboard-bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t-2 border-[#163A55] py-1.5 px-2 grid grid-cols-4 gap-1 shadow-[0_-4px_0_0_#CFE2EE]"
      >
        {quickNav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-1 min-h-[48px] font-mono text-[11px] font-medium transition-[background-color,color,box-shadow] duration-200 ${
                active
                  ? "bg-px-highlight text-[#0369A1] font-bold shadow-[inset_0_3px_0_#0369A1]"
                  : "text-secondary hover:text-foreground hover:bg-[#F0F7FB]"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${active ? "text-[#0369A1]" : "text-secondary"}`}
                aria-hidden="true"
              />
              <span>{label}</span>
            </Link>
          );
        })}

        {/* Button to open full drawer */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex flex-col items-center justify-center gap-1 py-2 px-1 min-h-[48px] font-mono text-[11px] font-medium text-secondary transition-colors hover:text-foreground hover:bg-[#F0F7FB]"
        >
          <Menu className="w-4 h-4 text-secondary" aria-hidden="true" />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}
