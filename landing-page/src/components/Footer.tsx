import Image from "next/image";
import Link from "next/link";
import { Github, Mail, MessageCircle, Instagram, Twitter } from "lucide-react";
import { API_DOCS_URL, GITHUB_URL, MCP_URL } from "@/lib/public-links";

const LINK_CLASS =
  "group inline-flex min-h-8 items-center gap-1.5 text-secondary transition-colors duration-200 hover:text-[#0369A1]";

function Marker() {
  return <span className="h-1.5 w-0 bg-[#0369A1] transition-all duration-200 ease-out group-hover:w-1.5" aria-hidden="true" />;
}

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
      <span className="h-1.5 w-1.5 bg-[#0369A1]" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Thin stepped-wave strip that tops the footer (same shore as muaraai.com). */
function PixelShore() {
  return (
    <svg className="block h-3 w-full" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
      <defs>
        <pattern id="footer-shore" width="16" height="12" patternUnits="userSpaceOnUse">
          <rect width="16" height="12" fill="#EEF6FB" />
          <rect y="4" width="4" height="8" fill="#9CC6E0" />
          <rect x="4" y="2" width="4" height="10" fill="#9CC6E0" />
          <rect x="8" y="4" width="4" height="8" fill="#9CC6E0" />
          <rect x="12" y="6" width="4" height="6" fill="#9CC6E0" />
          <rect y="8" width="16" height="4" fill="#5FA3CC" />
          <rect y="10" width="16" height="2" fill="#0369A1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#footer-shore)" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="bg-white">
      <PixelShore />
      <div className="px-4 pb-6 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3">
              <span className="px-frame flex h-11 w-11 items-center justify-center overflow-hidden bg-white [--px-line:#CFE2EE]">
                <Image src="/logo/logo.png" alt="Logo UBSI API" width={40} height={40} className="h-9 w-9" />
              </span>
              <div>
                <p className="font-display text-base font-bold text-foreground">UBSI API</p>
                <p className="font-mono text-xs text-secondary">by Muara AI</p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-secondary">
              Proyek independen non-komersial dari komunitas Muara AI. Bukan aplikasi resmi UBSI.</p>
          </div>

          <nav aria-label="Produk UBSI API" className="text-sm">
            <ColumnTitle>Produk</ColumnTitle>
            <ul className="space-y-1">
              <li><Link href="/login" className={LINK_CLASS}><Marker />Dashboard mahasiswa</Link></li>
              <li><a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}><Marker />API Docs</a></li>
              <li><a href={MCP_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}><Marker />MCP Server</a></li>
              <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}><Marker /><Github className="h-3.5 w-3.5" aria-hidden="true" /> GitHub</a></li>
            </ul>
          </nav>

          <div className="text-sm">
            <ColumnTitle>Legal dan kontak</ColumnTitle>
            <ul className="space-y-1">
              <li><Link href="/privacy" className={LINK_CLASS}><Marker />Kebijakan Privasi</Link></li>
              <li><Link href="/terms" className={LINK_CLASS}><Marker />Syarat dan Ketentuan</Link></li>
              <li><Link href="/dmca" className={LINK_CLASS}><Marker />DMCA dan HKI</Link></li>
              <li><a href="mailto:admin@muaraai.com" className={`${LINK_CLASS} break-all`}><Marker /><Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> admin@muaraai.com</a></li>
              <li><a href="https://www.threads.com/@muara.ai" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}><Marker /><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Threads</a></li>
              <li><a href="https://www.instagram.com/muara.ai/" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}><Marker /><Instagram className="h-3.5 w-3.5" aria-hidden="true" /> Instagram</a></li>
              <li><a href="https://x.com/MuaraAI" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}><Marker /><Twitter className="h-3.5 w-3.5" aria-hidden="true" /> X</a></li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t-2 border-dashed border-px-soft pt-5 font-mono text-[11px] text-secondary sm:flex-row sm:items-center sm:justify-between">
          <p>MIT License | Muara AI 2026</p>
          <a href="https://github.com/MuaraAI/UBSI-API/releases" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-[#0369A1]">
            <Marker />
            Lihat rilis di GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
