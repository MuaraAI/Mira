import type { Metadata } from "next";
import Link from "next/link";
import { Monogram } from "@/components/Monogram";

export const metadata: Metadata = {
  title: "Halaman Tidak Ditemukan",
  description: "Halaman yang Anda cari tidak tersedia di Mira UBSI.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-stroke bg-white/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Monogram className="h-7 w-7" />
            <span className="font-display text-sm font-bold text-foreground">Mira</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[36px] items-center text-xs font-semibold text-[#0369A1] hover:underline"
          >
            Masuk ke Dashboard
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-14 sm:px-6"
      >
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#0369A1]">
          404
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-secondary sm:text-base">
          Tautan yang Anda buka mungkin sudah dipindahkan atau tidak tersedia di Mira UBSI.
          Pilih salah satu halaman utama di bawah ini untuk melanjutkan.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white hover:text-[#072033] sm:text-sm"
          >
            Kembali ke Beranda
          </Link>
          <Link
            href="/demo"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[6px] border-[1px] border-stroke bg-white px-5 py-2.5 text-xs font-medium text-foreground transition-colors hover:border-[#072033] sm:text-sm"
          >
            Coba Demo Dashboard
          </Link>
          <Link
            href="/panduan"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[6px] border-[1px] border-stroke bg-white px-5 py-2.5 text-xs font-medium text-foreground transition-colors hover:border-[#072033] sm:text-sm"
          >
            Panduan Mahasiswa
          </Link>
          <Link
            href="/developers"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[6px] border-[1px] border-stroke bg-white px-5 py-2.5 text-xs font-medium text-foreground transition-colors hover:border-[#072033] sm:text-sm"
          >
            REST API &amp; MCP
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center px-2 text-xs font-medium text-[#0369A1] underline underline-offset-4 hover:text-[#075985] sm:text-sm"
          >
            Login Mahasiswa
          </Link>
        </div>
      </main>
    </div>
  );
}
