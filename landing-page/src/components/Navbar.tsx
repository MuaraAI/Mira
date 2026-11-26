"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Monogram } from "./Monogram";
import { SOCIAL_PROFILES } from "./SocialIcons";
import { API_DOCS_URL, GITHUB_URL } from "@/lib/public-links";
import { lockScroll } from "@/lib/scroll-lock";

const NAV_LINKS = [
  { href: "#fitur", label: "Fitur" },
  { href: "#cara-pakai", label: "Cara Pakai" },
  { href: "#stats", label: "Statistik" },
  { href: "#donasi", label: "Donasi" },
  { href: "#faq", label: "FAQ" },
  { href: "/developers", label: "API & MCP" },
];

const MOBILE_LINKS = [
  { href: "#fitur", label: "Fitur", external: false },
  { href: "#cara-pakai", label: "Cara Pakai", external: false },
  { href: "#stats", label: "Statistik", external: false },
  { href: "#donasi", label: "Donasi", external: false },
  { href: "#faq", label: "FAQ", external: false },
  { href: "/developers", label: "API & MCP", external: false },
  { href: API_DOCS_URL, label: "API Docs JSON", external: true },
  { href: GITHUB_URL, label: "GitHub", external: true },
];

function GithubIcon() {
  return (
    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function MenuLines({ open }: { open: boolean }) {
  return (
    <span className="relative flex h-3 w-4 flex-col justify-between" aria-hidden="true">
      <span
        className={`block h-[1.5px] w-4 rounded-[9999px] bg-current transition-transform duration-200 ${
          open ? "translate-y-[5.25px] rotate-45" : ""
        }`}
      />
      <span
        className={`block h-[1.5px] w-3 rounded-[9999px] bg-current transition-opacity duration-150 ${
          open ? "opacity-0" : "opacity-100"
        }`}
      />
      <span
        className={`block h-[1.5px] w-4 rounded-[9999px] bg-current transition-transform duration-200 ${
          open ? "-translate-y-[5.25px] -rotate-45" : ""
        }`}
      />
    </span>
  );
}

export function Navbar({ starsCount }: { starsCount: number | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("hashchange", handleScroll);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("hashchange", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const unlock = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileMenuOpen]);

  const overDark = !scrolled || mobileMenuOpen;
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header
        className="home-header fixed inset-x-0 top-0 z-50 w-full"
        data-scrolled={scrolled && !mobileMenuOpen}
      >
        <div className="mx-auto flex h-[58px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 md:h-[68px] lg:px-8">
          <Link href="/" className="group flex items-center gap-2.5 py-1">
            <Monogram className="h-8 w-8 shrink-0 transition-transform duration-300 group-hover:scale-105" />
            <span className="flex flex-col leading-none">
              <span
                className={`font-home-display text-[17px] tracking-[0.03em] transition-colors duration-200 sm:text-[18px] ${
                  overDark ? "text-white" : "text-foreground"
                }`}
              >
                Mira
              </span>
              <span
                className={`mt-0.5 font-mono text-[9.5px] tracking-[0.18em] uppercase transition-colors duration-200 ${
                  overDark ? "text-[#9AD8F8]" : "text-[#0369A1]"
                }`}
              >
                Muara AI
              </span>
            </span>
          </Link>

          <nav
            aria-label="Navigasi utama"
            className={`hidden items-center gap-0.5 text-[13px] font-normal tracking-[0.015em] md:flex ${
              overDark ? "text-white/85" : "text-secondary"
            }`}
          >
            {NAV_LINKS.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`home-nav-link inline-flex min-h-[44px] items-center whitespace-nowrap px-2.5 lg:px-3.5 ${
                    overDark ? "hover:text-white" : "hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className={`home-nav-link inline-flex min-h-[44px] items-center whitespace-nowrap px-2.5 lg:px-3.5 ${
                    overDark ? "hover:text-white" : "hover:text-foreground"
                  }`}
                >
                  {link.label}
                </a>
              )
            )}
          </nav>

          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-0.5 lg:flex" aria-label="Media sosial Mira">
              {SOCIAL_PROFILES.map(({ id, name, handle, href, icon: Icon }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow ${name} ${handle}`}
                  title={`${name} (${handle})`}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors duration-200 ${
                    overDark
                      ? "text-white/80 hover:bg-white/15 hover:text-white"
                      : "text-secondary hover:bg-[#EAF3F9] hover:text-[#072033]"
                  }`}
                >
                  <Icon className="h-[15px] w-[15px]" />
                </a>
              ))}
            </div>

            <span
              className={`hidden h-4 w-[1px] lg:block ${
                overDark ? "bg-white/20" : "bg-stroke"
              }`}
              aria-hidden="true"
            />

            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`hidden min-h-[38px] items-center gap-2 px-2 py-1.5 text-[12.5px] font-normal tracking-[0.015em] transition-colors duration-200 sm:inline-flex ${
                overDark
                  ? "text-white/85 hover:text-white"
                  : "text-secondary hover:text-foreground"
              }`}
              aria-label="Buka repository Mira di GitHub"
            >
              <GithubIcon />
              <span>GitHub</span>
              {starsCount !== null && (
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    overDark ? "text-[#9AD8F8]" : "text-[#0369A1]"
                  }`}
                >
                  {starsCount}
                </span>
              )}
            </a>

            <Link
              href="/login"
              className={`inline-flex h-9 items-center justify-center rounded-[6px] border-[1px] px-3.5 text-xs font-medium tracking-[0.015em] transition-colors duration-200 sm:min-h-[38px] sm:px-4 sm:text-[12.5px] ${
                overDark
                  ? "border-white bg-white text-[#072033] hover:bg-transparent hover:text-white"
                  : "border-[#072033] bg-[#072033] text-white hover:bg-transparent hover:text-[#072033]"
              }`}
            >
              Masuk
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-[8px] transition-colors duration-200 md:hidden ${
                overDark
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-[#F0F7FB] text-[#072033] hover:bg-[#DCEAF4]"
              }`}
            >
              <MenuLines open={mobileMenuOpen} />
            </button>
          </div>
        </div>
      </header>

      <div
        id="mobile-menu"
        aria-hidden={!mobileMenuOpen}
        className={`fixed inset-0 z-40 flex flex-col bg-[#072033] transition-opacity duration-200 md:hidden ${
          mobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <nav
          aria-label="Navigasi mobile"
          className="flex h-full flex-col overflow-y-auto px-6 pb-8 pt-24"
        >
          <ul className="flex flex-col divide-y-[1px] divide-white/10">
            {MOBILE_LINKS.map((link, index) => (
              <li key={link.href}>
                {!link.external && link.href.startsWith("/") ? (
                  <Link
                    href={link.href}
                    onClick={closeMobileMenu}
                    tabIndex={mobileMenuOpen ? 0 : -1}
                    className="flex min-h-[54px] items-center justify-between py-3 text-white/90 transition-colors hover:text-white"
                  >
                    <span className="text-xl font-normal tracking-[0.01em]">{link.label}</span>
                    <span className="font-mono text-xs text-[#7DD3FC]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </Link>
                ) : (
                  <a
                    href={link.href}
                    onClick={closeMobileMenu}
                    tabIndex={mobileMenuOpen ? 0 : -1}
                    {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex min-h-[54px] items-center justify-between py-3 text-white/90 transition-colors hover:text-white"
                  >
                    <span className="text-xl font-normal tracking-[0.01em]">{link.label}</span>
                    <span className="font-mono text-xs text-[#7DD3FC]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </a>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-auto space-y-4 border-t-[1px] border-white/10 pt-5">
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#9AD8F8]">
                Follow Update Mira
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SOCIAL_PROFILES.map(({ id, name, handle, href, icon: Icon }) => (
                  <a
                    key={id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={mobileMenuOpen ? 0 : -1}
                    aria-label={`Follow ${name} ${handle}`}
                    className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-[6px] border-[1px] border-white/20 bg-white/5 px-2.5 text-xs text-white transition-colors hover:border-white hover:bg-white hover:text-[#072033]"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{name}</span>
                  </a>
                ))}
              </div>
            </div>

            <Link
              href="/login"
              onClick={closeMobileMenu}
              tabIndex={mobileMenuOpen ? 0 : -1}
              className="flex min-h-[46px] w-full items-center justify-center rounded-[6px] border-[1px] border-white bg-white px-5 py-3 text-sm font-medium text-[#072033] transition-colors duration-200 hover:bg-transparent hover:text-white"
            >
              Masuk ke Dashboard
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
