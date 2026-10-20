import Image from "next/image";
import Link from "next/link";
import { Github, Mail, MessageCircle, Instagram, Twitter } from "lucide-react";
import { API_DOCS_URL, GITHUB_URL, MCP_URL } from "@/lib/public-links";


export function Footer() {
  return (
    <footer className="border-t border-stroke bg-white px-4 py-12 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/logo/logo.png" alt="Logo UBSI API" width={40} height={40} className="h-10 w-10" />
            <div>
              <p className="font-display text-base font-bold text-foreground">UBSI API</p>
              <p className="font-mono text-xs text-secondary">by Muara AI</p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-secondary">
            Proyek riset independen non-komersial komunitas Muara AI. Tidak berafiliasi secara resmi dengan Universitas Bina Sarana Informatika.
          </p>
        </div>

        <nav aria-label="Produk UBSI API" className="text-sm">
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-widest text-secondary">Produk</p>
          <ul className="space-y-2.5">
            <li><Link href="/login" className="text-secondary hover:text-foreground">Dashboard mahasiswa</Link></li>
            <li><a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-foreground">API Docs</a></li>
            <li><a href={MCP_URL} target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-foreground">MCP Server</a></li>
            <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground"><Github className="h-3.5 w-3.5" aria-hidden="true" /> GitHub</a></li>
          </ul>
        </nav>

        <div className="text-sm">
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-widest text-secondary">Legal dan kontak</p>
          <ul className="space-y-2.5">
            <li><Link href="/privacy" className="text-secondary hover:text-foreground">Kebijakan Privasi</Link></li>
            <li><Link href="/terms" className="text-secondary hover:text-foreground">Syarat dan Ketentuan</Link></li>
            <li><Link href="/dmca" className="text-secondary hover:text-foreground">DMCA dan HKI</Link></li>
            <li><a href="mailto:admin@muaraai.com" className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground"><Mail className="h-3.5 w-3.5" aria-hidden="true" /> admin@muaraai.com</a></li>
            <li><a href="https://www.threads.com/@muara.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Threads</a></li>
            <li><a href="https://www.instagram.com/muara.ai/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground"><Instagram className="h-3.5 w-3.5" aria-hidden="true" /> Instagram</a></li>
            <li><a href="https://x.com/MuaraAI" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground"><Twitter className="h-3.5 w-3.5" aria-hidden="true" /> X</a></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-stroke pt-6 text-[11px] text-secondary sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono">MIT License | Muara AI 2026</p>
        <a href="https://github.com/MuaraAI/UBSI-API/releases" target="_blank" rel="noopener noreferrer" className="font-mono hover:text-foreground">Lihat rilis di GitHub</a>
      </div>
    </footer>
  );
}
