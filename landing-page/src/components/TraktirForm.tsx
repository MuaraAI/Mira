"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Copy, Heart } from "lucide-react";
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

export function TraktirForm({ idPrefix = "donasi" }: { idPrefix?: string }) {
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
    <form
      onSubmit={handleDonateSubmit}
      className="rounded-[12px] border-[1px] border-stroke bg-[#F8FBFD] p-4 sm:p-6"
    >
      <div className="flex items-center justify-between gap-2 border-b-[1px] border-stroke pb-3.5">
        <span className="text-[14px] font-medium text-foreground">Pilih traktiran kamu</span>
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
            htmlFor={`${idPrefix}-nominal`}
            className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary"
          >
            Nominal lain (opsional)
          </label>
          <div className="flex items-center rounded-[6px] border-[1px] border-[#CFE0EC] bg-white px-3 focus-within:border-[#0369A1]">
            <span className="font-mono text-xs text-secondary">Rp</span>
            <input
              id={`${idPrefix}-nominal`}
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
            htmlFor={`${idPrefix}-nama`}
            className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary"
          >
            Nama / Panggilan (opsional)
          </label>
          <input
            id={`${idPrefix}-nama`}
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
            htmlFor={`${idPrefix}-pesan`}
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
          id={`${idPrefix}-pesan`}
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
        Pembayaran diproses aman lewat SociaBuzz (QRIS, GoPay, OVO, DANA, ShopeePay, dan Transfer
        Bank). Catatan kamu otomatis disalin biar tinggal tempel kalau mau.
      </p>
    </form>
  );
}
