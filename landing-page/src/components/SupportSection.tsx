"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Check, Copy, Heart } from "lucide-react";
import { RevealOnScroll } from "./HomeParallax";
import { SOCIAL_PROFILES } from "./SocialIcons";
import { DONATE_URL } from "@/lib/public-links";

const PRESETS = [
  { amount: 10_000, label: "Rp10rb", note: "Es kopi begadang" },
  { amount: 25_000, label: "Rp25rb", note: "Bensin server mingguan" },
  { amount: 50_000, label: "Rp50rb", note: "Support domain & VPS" },
  { amount: 100_000, label: "Rp100rb", note: "Sultan Muara AI" },
] as const;

function formatRp(n: number): string {
  return `Rp${new Intl.NumberFormat("id-ID").format(n)}`;
}

export function SupportSection() {
  const [selected, setSelected] = useState<number>(25_000);
  const [customAmount, setCustomAmount] = useState("");
  const [supporter, setSupporter] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const numericCustom = Number(customAmount.replace(/\D/g, "")) || 0;
  const activeAmount = customAmount.trim() ? numericCustom : selected;
  const activePreset = PRESETS.find((p) => p.amount === activeAmount);

  const summaryText = [
    supporter.trim() ? `Dari ${supporter.trim()}` : "Dari anak UBSI",
    activeAmount > 0 ? `(${formatRp(activeAmount)})` : "",
    message.trim() ? `: ${message.trim()}` : ": Semangat terus ngembangin Mira!",
  ]
    .filter(Boolean)
    .join(" ");

  async function handleCopyNote() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* abaikan bila clipboard tidak tersedia */
    }
  }

  function handleDonateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim() || supporter.trim()) {
      navigator.clipboard?.writeText(summaryText).catch(() => {});
    }
    window.open(DONATE_URL, "_blank", "noopener,noreferrer");
  }

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
            <form
              onSubmit={handleDonateSubmit}
              className="rounded-[12px] border-[1px] border-stroke bg-[#F8FBFD] p-5 sm:p-6"
            >
              <div className="flex items-center justify-between gap-2 border-b-[1px] border-stroke pb-3.5">
                <span className="text-[14px] font-medium text-foreground">
                  Pilih traktiran kamu
                </span>
                <span className="font-mono text-[11px] text-[#0369A1]">sociabuzz.com/muaraai</span>
              </div>

              {/* Preset nominal grid */}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRESETS.map((preset) => {
                  const active = !customAmount.trim() && selected === preset.amount;
                  return (
                    <button
                      key={preset.amount}
                      type="button"
                      onClick={() => {
                        setSelected(preset.amount);
                        setCustomAmount("");
                      }}
                      className={`flex min-h-[60px] flex-col justify-between rounded-[8px] border-[1px] px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "border-[#072033] bg-[#072033] text-white"
                          : "border-stroke bg-white text-foreground hover:border-[#0369A1]"
                      }`}
                    >
                      <span className="font-display text-[15px] font-semibold tabular-nums">
                        {preset.label}
                      </span>
                      <span
                        className={`mt-0.5 text-[10.5px] leading-tight ${
                          active ? "text-[#BAE6FD]" : "text-secondary"
                        }`}
                      >
                        {preset.note}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom nominal + Nama */}
              <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="donasi-nominal"
                    className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary"
                  >
                    Nominal lain (opsional)
                  </label>
                  <div className="flex items-center rounded-[6px] border-[1px] border-[#CFE0EC] bg-white px-3 focus-within:border-[#0369A1]">
                    <span className="font-mono text-xs text-secondary">Rp</span>
                    <input
                      id="donasi-nominal"
                      type="text"
                      inputMode="numeric"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ""))}
                      placeholder="15000"
                      className="min-h-[40px] w-full bg-transparent pl-2 font-mono text-sm text-foreground outline-none placeholder:text-secondary/50"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="donasi-nama"
                    className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary"
                  >
                    Nama / Panggilan (opsional)
                  </label>
                  <input
                    id="donasi-nama"
                    type="text"
                    maxLength={40}
                    value={supporter}
                    onChange={(e) => setSupporter(e.target.value)}
                    placeholder="Misal: Anak TI Sem 3"
                    className="min-h-[40px] w-full rounded-[6px] border-[1px] border-[#CFE0EC] bg-white px-3 text-sm text-foreground outline-none placeholder:text-secondary/50 focus:border-[#0369A1]"
                  />
                </div>
              </div>

              {/* Optional support message */}
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label
                    htmlFor="donasi-pesan"
                    className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary"
                  >
                    Pesan buat tim Mira (opsional)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyNote}
                    className="inline-flex items-center gap-1 text-[11px] text-[#0369A1] hover:text-[#072033]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" aria-hidden="true" />
                        Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        Salin catatan
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  id="donasi-pesan"
                  rows={2}
                  maxLength={160}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Gas terus bang, Mira ngebantu banget buat cek tugas sama absen!"
                  className="w-full resize-none rounded-[6px] border-[1px] border-[#CFE0EC] bg-white px-3 py-2 text-sm text-foreground outline-none placeholder:text-secondary/50 focus:border-[#0369A1]"
                />
              </div>

              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] text-secondary">
                  {activeAmount > 0 ? (
                    <>
                      Pilihan:{" "}
                      <strong className="font-display font-semibold text-foreground tabular-nums">
                        {formatRp(activeAmount)}
                      </strong>
                      {activePreset ? ` (${activePreset.note})` : ""}
                    </>
                  ) : (
                    "Nominal bebas bisa diatur langsung di SociaBuzz."
                  )}
                </p>

                <button
                  type="submit"
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-5 py-2.5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-white hover:text-[#072033]"
                >
                  <Heart className="h-4 w-4" aria-hidden="true" />
                  <span>Traktir di SociaBuzz</span>
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <p className="mt-3 border-t-[1px] border-stroke pt-2.5 text-[11px] leading-relaxed text-secondary">
                Pembayaran diproses aman lewat SociaBuzz (QRIS, GoPay, OVO, DANA, ShopeePay, dan
                Transfer Bank). Catatan kamu otomatis disalin biar tinggal tempel kalau mau.
              </p>
            </form>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
