"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Monogram } from "./Monogram";

const API_DOCS_URL = "https://api.muaraai.com/v1/ubsi-api/v1/docs";
const MCP_URL = "https://api.muaraai.com/v1/ubsi-api/mcp";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full px-4 py-3 sm:px-6">
      <div className={`mx-auto flex h-14 max-w-6xl items-center justify-between rounded-xl border border-stroke bg-white/95 px-4 shadow-sm backdrop-blur-sm transition-shadow sm:px-5 ${scrolled ? "shadow-[0_10px_26px_-18px_rgba(7,32,51,0.5)]" : ""}`}>
        <Link href="/" className="group flex items-center gap-3 focus-visible:outline-none">
          <Monogram className="h-7 w-7 transition-transform group-hover:scale-105" />
          <span className="flex flex-col">
            <span className="font-display text-base font-bold tracking-tight text-foreground">UBSI API</span>
            <span className="-mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0369A1]">Muara AI</span>
          </span>
        </Link>

        <nav aria-label="Navigasi utama" className="hidden items-center gap-6 text-sm text-secondary md:flex">
          <a href="#layanan" className="transition-colors hover:text-foreground">Layanan</a>
          <a href="#api" className="transition-colors hover:text-foreground">API Docs</a>
          <a href="#mcp" className="transition-colors hover:text-foreground">MCP</a>
          <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">Dokumentasi</a>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/MuaraAI/UBSI-API"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden min-h-10 items-center gap-2 rounded-lg border border-stroke bg-white px-3 text-xs font-mono text-foreground transition-colors hover:border-[#0369A1] hover:text-[#075985] sm:inline-flex"
            aria-label="Buka repository UBSI API di GitHub"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
          <Link href="/login" className="hidden min-h-10 items-center justify-center rounded-lg bg-[#0369A1] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#075985] sm:inline-flex">
            Masuk
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-stroke bg-white text-foreground transition-colors hover:text-[#0369A1] md:hidden"
          >
            <span aria-hidden="true" className="text-xl leading-none">{mobileMenuOpen ? "×" : "≡"}</span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav id="mobile-menu" aria-label="Navigasi mobile" className="mx-auto mt-2 max-w-6xl rounded-xl border border-stroke bg-white p-4 shadow-sm md:hidden">
          <div className="grid gap-1 text-sm text-secondary">
            <a href="#layanan" onClick={closeMobileMenu} className="rounded-lg px-3 py-3 hover:bg-[#F0F7FB] hover:text-foreground">Layanan</a>
            <a href="#api" onClick={closeMobileMenu} className="rounded-lg px-3 py-3 hover:bg-[#F0F7FB] hover:text-foreground">API Docs</a>
            <a href="#mcp" onClick={closeMobileMenu} className="rounded-lg px-3 py-3 hover:bg-[#F0F7FB] hover:text-foreground">MCP</a>
            <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" onClick={closeMobileMenu} className="rounded-lg px-3 py-3 hover:bg-[#F0F7FB] hover:text-foreground">Dokumentasi publik</a>
            <a href={MCP_URL} target="_blank" rel="noopener noreferrer" onClick={closeMobileMenu} className="rounded-lg px-3 py-3 hover:bg-[#F0F7FB] hover:text-foreground">Endpoint MCP</a>
          </div>
          <div className="mt-3 border-t border-stroke pt-3">
            <Link href="/login" onClick={closeMobileMenu} className="flex min-h-11 items-center justify-center rounded-lg bg-[#0369A1] px-4 py-3 text-sm font-semibold text-white hover:bg-[#075985]">Masuk ke Dashboard</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
