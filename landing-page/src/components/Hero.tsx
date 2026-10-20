import Link from "next/link";
import { DataCurrent } from "./DataCurrent";

const API_DOCS_URL = "https://api.muaraai.com/v1/ubsi-api/v1/docs";

export function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20" aria-labelledby="hero-title">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-16">
        <div>
          <p className="section-kicker mb-5">Layanan akademik UBSI</p>
          <h1 id="hero-title" className="max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-6xl">
            Satu jalur untuk data kuliahmu.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-secondary sm:text-lg">
            UBSI API menghubungkan jadwal, materi, tugas, presensi, nilai, dan layanan kampus dalam satu tempat. Mahasiswa memakai dashboard. Developer dan AI agent memakai REST API atau MCP.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#0369A1] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#075985]"
            >
              Masuk ke Dashboard
            </Link>
            <a
              href={API_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stroke bg-white px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-[#0369A1] hover:text-[#075985]"
            >
              Buka API Docs
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-secondary">
            <span>Dashboard mahasiswa</span>
            <span>REST API publik</span>
            <span>MCP untuk integrasi</span>
          </div>
        </div>

        <DataCurrent />
      </div>
    </section>
  );
}
