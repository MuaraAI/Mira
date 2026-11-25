"use client";

import Image from "next/image";
import { RevealOnScroll } from "./HomeParallax";
import { SOCIAL_PROFILES } from "./SocialIcons";
import { TraktirForm } from "./TraktirForm";

export function SupportSection() {
  return (
    <section
      id="donasi"
      className="border-b-[1px] border-stroke bg-white py-14 sm:py-20 scroll-mt-24"
      aria-labelledby="donasi-title"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-14">
          {/* Left: Cute Assistant Mura + Casual Copy */}
          <RevealOnScroll className="min-w-0">
            <div className="flex items-center gap-4 sm:gap-5">
              <Image
                src="/maskot/mura-assistant.png"
                alt="Asisten Mura siap nemenin kuliah kamu di Mira"
                width={120}
                height={120}
                className="h-24 w-24 shrink-0 object-contain sm:h-28 sm:w-28"
              />
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0369A1]">
                  TRAKTIR SERVER MIRA
                </p>
                <h2
                  id="donasi-title"
                  className="font-home-display mt-1.5 text-[clamp(1.55rem,3vw,2.15rem)] leading-[1.15] tracking-[-0.01em] text-foreground"
                >
                  Bantu Mira biar tetap hidup dan gratis
                </h2>
              </div>
            </div>

            <p className="mt-5 text-[14px] leading-[1.75] text-secondary sm:text-[15px]">
              Mira 100% gratis, bebas iklan, dan dikerjain bareng komunitas Muara AI biar urusan
              kuliah kamu di UBSI nggak ribet lagi. Tapi server, domain, sama kopi pas begadang
              benerin bug tetap butuh bensin.
            </p>
            <p className="mt-3 text-[14px] leading-[1.75] text-secondary sm:text-[15px]">
              Kalau Mira ngebantu kamu cek jadwal, ngejar deadline tugas, atau absen lebih cepat,
              boleh banget ikut patungan seikhlasnya lewat SociaBuzz. Nggak ada minimal, yang
              penting Mira jalan terus.
            </p>

            <dl className="mt-6 grid grid-cols-3 divide-x-[1px] divide-stroke rounded-[8px] border-[1px] border-stroke bg-surface-alt">
              <div className="px-3.5 py-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
                  Status
                </dt>
                <dd className="mt-1 text-[13px] font-medium text-foreground">Gratis &amp; Open</dd>
              </div>
              <div className="px-3.5 py-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
                  Metode
                </dt>
                <dd className="mt-1 text-[13px] font-medium text-foreground">QRIS &amp; E-Wallet</dd>
              </div>
              <div className="px-3.5 py-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
                  Alokasi
                </dt>
                <dd className="mt-1 text-[13px] font-medium text-foreground">VPS &amp; Domain</dd>
              </div>
            </dl>

            <div className="mt-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-secondary">
                Follow update &amp; info fitur baru
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {SOCIAL_PROFILES.map(({ id, name, handle, href, icon: Icon }) => (
                  <a
                    key={id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex min-h-[40px] items-center gap-2 rounded-[6px] border-[1px] border-stroke bg-white px-3.5 py-2 text-xs text-foreground transition-colors duration-200 hover:border-[#072033] hover:bg-[#072033] hover:text-white"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[#0369A1] transition-colors group-hover:text-[#7DD3FC]" />
                    <span className="font-medium">{name}</span>
                    <span className="font-mono text-[11px] text-secondary transition-colors group-hover:text-[#CBE0EE]">
                      {handle}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* Right: Interactive Casual Donation Form -> SociaBuzz */}
          <RevealOnScroll delayMs={80} className="min-w-0">
            <TraktirForm idPrefix="donasi" />
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
