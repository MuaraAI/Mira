import Image from "next/image";
import Link from "next/link";
import { Github, Mail } from "lucide-react";
import { ParallaxLayer } from "./HomeParallax";
import { SOCIAL_PROFILES } from "./SocialIcons";
import { API_DOCS_URL, DONATE_URL, GITHUB_URL, MCP_URL } from "@/lib/public-links";

const LINK_CLASS =
  "inline-flex min-h-[44px] items-center gap-2 text-secondary transition-colors duration-200 hover:text-[#0369A1]";

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-foreground">
      {children}
    </p>
  );
}

function OceanWaveDivider() {
  return (
    <div className="relative h-14 w-full overflow-hidden bg-background sm:h-20" aria-hidden="true">
      <ParallaxLayer speed={12} className="absolute inset-0">
        <svg
          className="block h-full w-full"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
        >
          <path
            d="M0,44 C260,12 520,68 780,38 C1040,8 1260,54 1440,28 L1440,80 L0,80 Z"
            fill="#DCEBF5"
          />
        </svg>
      </ParallaxLayer>
      <svg
        className="relative z-10 block h-full w-full"
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
      >
        <path
          d="M0,58 C300,32 580,74 900,48 C1140,28 1310,60 1440,44 L1440,80 L0,80 Z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-white">
      <OceanWaveDivider />
      <div className="px-5 pb-8 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.4fr_0.8fr_0.8fr] md:gap-y-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3">
              <Image
                src="/logo/logo.png"
                alt="Logo Mira"
                width={38}
                height={38}
                className="h-9 w-9 object-contain"
              />
              <div>
                <p className="text-lg tracking-[-0.01em] text-foreground">Mira</p>
                <p className="font-mono text-xs text-secondary">by Muara AI</p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-[13px] leading-[1.7] tracking-[0.012em] text-secondary">
              Dikembangkan oleh mahasiswa Informatika UBSI Kampus Pontianak di bawah bendera riset
              open-source komunitas Muara AI. Bukan aplikasi resmi UBSI.
            </p>
          </div>

          <nav aria-label="Produk Mira" className="text-[13px] tracking-[0.012em]">
            <ColumnTitle>Produk</ColumnTitle>
            <ul className="space-y-0.5">
              <li>
                <Link href="/login" className={LINK_CLASS}>
                  Dashboard mahasiswa
                </Link>
              </li>
              <li>
                <Link href="/demo" className={LINK_CLASS}>
                  Demo interaktif
                </Link>
              </li>
              <li>
                <a
                  href={API_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASS}
                >
                  API Docs
                </a>
              </li>
              <li>
                <a
                  href={MCP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASS}
                >
                  MCP Server
                </a>
              </li>
              <li>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASS}
                >
                  <Github className="h-3.5 w-3.5" aria-hidden="true" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={DONATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASS}
                >
                  Dukung Mira (SociaBuzz)
                </a>
              </li>
            </ul>
          </nav>

          <div className="text-[13px] tracking-[0.012em]">
            <ColumnTitle>Legal dan kontak</ColumnTitle>
            <ul className="space-y-0.5">
              <li>
                <Link href="/privacy" className={LINK_CLASS}>
                  Kebijakan Privasi
                </Link>
              </li>
              <li>
                <Link href="/terms" className={LINK_CLASS}>
                  Syarat dan Ketentuan
                </Link>
              </li>
              <li>
                <Link href="/dmca" className={LINK_CLASS}>
                  DMCA dan HKI
                </Link>
              </li>
              <li>
                <a href="mailto:admin@muaraai.com" className={`${LINK_CLASS} break-all`}>
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  admin@muaraai.com
                </a>
              </li>
              {SOCIAL_PROFILES.map(({ id, name, handle, href, icon: Icon }) => (
                <li key={id}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK_CLASS}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {name} <span className="font-mono text-[11px] text-secondary/75">{handle}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-3 border-t-[1px] border-stroke pt-6 font-mono text-xs text-secondary sm:mt-10 sm:flex-row sm:items-center sm:justify-between">
          <p>MIT License | Muara AI 2026</p>
          <a
            href="https://github.com/MuaraAI/Mira/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center text-foreground transition-colors hover:text-[#0369A1]"
          >
            Lihat rilis di GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
