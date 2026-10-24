"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Monogram } from "./Monogram";
import { API_DOCS_URL, GITHUB_URL } from "@/lib/public-links";
import { lockScroll } from "@/lib/scroll-lock";

const NAV_LINKS = [
  { href: "#fitur", label: "Fitur" },
  { href: "#cara-pakai", label: "Cara Pakai" },
  { href: "#stats", label: "Mira dalam Angka" },
  { href: "#faq", label: "FAQ" },
];

const MOBILE_LINKS = [
  { href: "#fitur", label: "Fitur", external: false },
  { href: "#cara-pakai", label: "Cara Pakai", external: false },
  { href: "#stats", label: "Mira dalam Angka", external: false },
  { href: "#faq", label: "FAQ", external: false },
  { href: API_DOCS_URL, label: "API Docs", external: true },
  { href: GITHUB_URL, label: "GitHub", external: true },
];

const TILE = 44;

function GithubIcon() {
  return (
    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/** Hamburger built from three 2px bars that fold into an X. */
function PixelBurger({ open }: { open: boolean }) {
  return (
    <span className="px-burger relative block h-3 w-4" data-open={open} aria-hidden="true">
      <span className="absolute left-0 top-0 block h-[2px] w-4 bg-current" />
      <span className="absolute left-0 top-[5px] block h-[2px] w-4 bg-current" />
      <span className="absolute left-0 top-[10px] block h-[2px] w-4 bg-current" />
    </span>
  );
}

// Deterministic sprinkle of lighter tiles so the takeover reads as pixel art, not a flat fill.
function tileColor(c: number, r: number) {
  const h = (c * 73 + r * 151) % 29;
  if (h === 0) return "#0369A1";
  if (h === 7 || h === 19) return "#0B2D46";
  return "#072033";
}

/** Mobile menu: tiles sweep in diagonally, then the links reveal line by line (CSS only). */
function PixelTakeover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [grid, setGrid] = useState({ cols: 0, rows: 0 });
  const [shown, setShown] = useState(false);
  const [cursor, setCursor] = useState(MOBILE_LINKS[0].href);

  useEffect(() => {
    setGrid({ cols: Math.ceil(window.innerWidth / TILE), rows: Math.ceil(window.innerHeight / TILE) });
  }, []);

  // Flip after two frames so the hidden state is painted first, then transitioned.
  useEffect(() => {
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setShown(open));
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const onResize = () => window.innerWidth >= 768 && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, onClose]);

  const span = grid.cols + grid.rows;

  return (
    <div className={`px-takeover fixed inset-0 -z-10 md:hidden ${open ? "" : "pointer-events-none"}`} data-open={shown} aria-hidden={!open}>
      <div
        className="absolute inset-0 grid overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${grid.cols}, ${TILE}px)`, gridAutoRows: `${TILE}px` }}
        aria-hidden="true"
      >
        {Array.from({ length: grid.cols * grid.rows }, (_, i) => {
          const c = i % grid.cols;
          const r = Math.floor(i / grid.cols);
          const color = tileColor(c, r);
          return (
            <span
              key={i}
              className="px-tile"
              data-accent={color === "#0369A1" ? "" : undefined}
              style={{
                backgroundColor: color,
                ["--d-in" as string]: `${(c + r) * 22}ms`,
                ["--d-out" as string]: `${(span - (c + r)) * 14}ms`,
              }}
            />
          );
        })}
      </div>

      <nav id="mobile-menu" aria-label="Navigasi mobile" className="px-takeover-content relative flex h-full flex-col overflow-y-auto px-6 pb-8 pt-28">
        <ul className="flex flex-col gap-1">
          {MOBILE_LINKS.map((link, i) => {
            const lit = cursor === link.href;
            return (
              <li key={link.href} className="px-line" style={{ ["--i" as string]: i }}>
                <a
                  href={link.href}
                  onClick={onClose}
                  onMouseEnter={() => setCursor(link.href)}
                  onFocus={() => setCursor(link.href)}
                  tabIndex={open ? 0 : -1}
                  {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex min-h-11 items-baseline gap-4 py-2"
                >
                  <span className={`font-mono text-xs font-bold transition-colors duration-200 ${lit ? "text-px-sun" : "text-px-water-mid"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={`font-display text-3xl font-bold tracking-tight transition-colors duration-200 min-[400px]:text-4xl ${lit ? "text-white" : "text-white/55"}`}>
                    {link.label}
                  </span>
                  {lit && <span className="px-cursor h-6 w-2.5 self-center bg-px-sun" aria-hidden="true" />}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="px-line mt-auto pt-8" style={{ ["--i" as string]: MOBILE_LINKS.length }}>
          <div className="pb-1 pr-1">
            <Link
              href="/login"
              onClick={onClose}
              tabIndex={open ? 0 : -1}
              className="px-btn-ocean flex min-h-12 items-center justify-center gap-2 text-sm font-bold"
            >
              Masuk ke Dashboard
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
}

export function Navbar({ starsCount }: { starsCount: number | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full px-4 py-3 sm:px-6">
      <div
        className="px-nav mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-4"
        data-scrolled={scrolled}
        data-menu-open={mobileMenuOpen}
      >
        <Link href="/" className="group flex items-center gap-3">
          <span className="px-frame flex h-9 w-9 items-center justify-center overflow-hidden bg-white [--px-line:#CFE2EE]">
            <Monogram className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />
          </span>
          <span className="flex flex-col">
            <span className="nav-brand-text font-display text-base font-bold tracking-tight text-foreground">Mira</span>
            <span className="-mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0369A1]">Muara AI</span>
          </span>
        </Link>

        <nav aria-label="Navigasi utama" className="hidden items-center gap-1 text-sm font-medium text-secondary md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="nav-link px-3 py-1.5 hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-btn-ghost hidden min-h-9 items-center gap-2 px-3 py-1.5 font-mono text-xs font-semibold [--px-off:3px] sm:inline-flex"
            aria-label="Buka repository Mira di GitHub"
          >
            <GithubIcon />
            GitHub{starsCount !== null ? ` · ${starsCount} stars` : ""}
          </a>
          <Link href="/login" className="px-btn hidden min-h-9 items-center justify-center px-4 py-1.5 text-xs font-bold [--px-off:3px] sm:inline-flex">
            Masuk
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
            className="nav-menu-button px-frame flex h-11 w-11 items-center justify-center bg-white text-foreground [--px-line:#CFE2EE] hover:text-[#0369A1] md:hidden"
          >
            <PixelBurger open={mobileMenuOpen} />
          </button>
        </div>
      </div>

      <PixelTakeover open={mobileMenuOpen} onClose={closeMobileMenu} />
    </header>
  );
}
