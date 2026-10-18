import Image from "next/image";
import Link from "next/link";
import { Github, Mail, MessageCircle, Instagram, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-stroke bg-white/30 backdrop-blur-sm py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto grid gap-10 md:grid-cols-3">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/logo/logo.png"
              alt="Logo UBSI API"
              width={40}
              height={40}
              className="w-10 h-10"
            />
            <div>
              <div className="font-display font-bold text-base text-foreground">
                UBSI API
              </div>
              <div className="text-xs font-mono text-secondary">
                by Muara AI
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-secondary leading-relaxed max-w-xs">
            Proyek riset independen non-komersial komunitas Muara AI dan tidak
            berafiliasi secara resmi dengan institusi Universitas Bina Sarana
            Informatika.
          </p>
        </div>

        {/* Legal & Resources */}
        <nav aria-label="Tautan legal dan sumber daya" className="text-sm">
          <p className="text-[11px] font-mono uppercase tracking-widest text-secondary font-bold mb-3">
            Legal &amp; Sumber
          </p>
          <ul className="space-y-2">
            <li>
              <LinkLegal href="/privacy">Kebijakan Privasi</LinkLegal>
            </li>
            <li>
              <LinkLegal href="/terms">Syarat dan Ketentuan</LinkLegal>
            </li>
            <li>
              <a
                href="https://github.com/MuaraAI/UBSI-API"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground transition-colors"
              >
                <Github className="h-3.5 w-3.5" aria-hidden="true" />
                github.com/MuaraAI/UBSI-API
              </a>
            </li>
            <li>
              <a
                href="mailto:admin@muaraai.com"
                className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground transition-colors"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                admin@muaraai.com
              </a>
            </li>
          </ul>
        </nav>

        {/* Community */}
        <div className="text-sm">
          <p className="text-[11px] font-mono uppercase tracking-widest text-secondary font-bold mb-3">
            Komunitas
          </p>
          <ul className="space-y-2">
            <li>
              <a
                href="https://www.threads.com/@muara.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Threads: @muara.ai
              </a>
            </li>
            <li>
              <a
                href="https://www.instagram.com/muara.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground transition-colors"
              >
                <Instagram className="h-3.5 w-3.5" aria-hidden="true" />
                Instagram: @muara.ai
              </a>
            </li>
            <li>
              <a
                href="https://x.com/MuaraAI"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground transition-colors"
              >
                <Twitter className="h-3.5 w-3.5" aria-hidden="true" />
                X: @MuaraAI
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-stroke/60 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-[11px] font-mono text-secondary">
          MIT License | Muara AI 2026
        </p>
        <a
          href="https://github.com/MuaraAI/UBSI-API/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-mono text-secondary hover:text-foreground transition-colors"
        >
          v1.2.0 Stable
        </a>
      </div>
    </footer>
  );
}

function LinkLegal({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-secondary hover:text-foreground transition-colors"
    >
      {children}
    </Link>
  );
}
