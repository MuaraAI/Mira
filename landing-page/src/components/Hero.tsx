import Link from "next/link";
import { DataCurrent } from "./DataCurrent";
import { API_DOCS_URL } from "@/lib/public-links";

const highlights = ["Dashboard mahasiswa", "REST API publik", "MCP untuk integrasi"];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b-2 border-px-soft" aria-labelledby="hero-title">
      <div className="pointer-events-none absolute -right-24 top-12 h-72 w-72 bg-sky-100/50 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-16 lg:px-8">
        <div className="stagger-rise min-w-0">
          <p className="px-chip mb-6 inline-flex items-center gap-2 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-secondary [--px-line:#CFE2EE]">
            <span className="h-1.5 w-1.5 bg-[#0F766E]" aria-hidden="true" />
            Layanan akademik UBSI
          </p>
          <h1 id="hero-title" className="max-w-3xl font-display text-[2.4rem] font-bold leading-[1.04] tracking-[-0.04em] text-foreground min-[400px]:text-5xl sm:text-6xl xl:text-7xl">
            <span className="line-mask"><span style={{ ["--i" as string]: 0 }}>Satu jalur untuk</span></span>
            <span className="line-mask">
              <span className="text-[#0369A1]" style={{ ["--i" as string]: 1 }}>
                data kuliahmu.<span className="px-cursor ml-1 inline-block h-[0.8em] w-[0.4em] translate-y-[0.06em] bg-[#0369A1]" aria-hidden="true" />
              </span>
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-secondary sm:text-lg">
            UBSI API menghubungkan jadwal, materi, tugas, presensi, nilai, dan layanan kampus dalam satu tempat. Mahasiswa memakai dashboard. Developer dan AI agent memakai REST API atau MCP.
          </p>

          <div className="mt-9 grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap">
            <Link href="/login" className="px-btn inline-flex min-h-11 items-center justify-center gap-2 px-5 py-3 text-sm font-bold">
              Masuk ke Dashboard
              <span aria-hidden="true">→</span>
            </Link>
            <a
              href={API_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-btn-ghost inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm font-semibold"
            >
              Buka API Docs
            </a>
          </div>

          <ul className="mt-10 flex flex-wrap gap-3 text-sm text-secondary">
            {highlights.map((item) => (
              <li key={item} className="px-chip inline-flex items-center gap-2 bg-white px-3 py-1.5 font-mono text-xs [--px-line:#CFE2EE]">
                <span className="h-1.5 w-1.5 bg-[#0369A1]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <DataCurrent />
      </div>
    </section>
  );
}
