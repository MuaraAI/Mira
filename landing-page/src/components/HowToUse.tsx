import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Github } from "lucide-react";
import { ParallaxFrame, RevealOnScroll } from "./HomeParallax";
import type { RepositoryContributor } from "@/lib/github";
import { GITHUB_URL } from "@/lib/public-links";

interface PortalSummary {
  name: string;
  host: string;
  scope: string;
}

const PORTALS: PortalSummary[] = [
  {
    name: "MyBest",
    host: "elearning.bsi.ac.id",
    scope: "Login utama, jadwal, tugas, presensi, kuis, materi",
  },
  {
    name: "SIAKAD",
    host: "students.bsi.ac.id",
    scope: "Profil, KHS, KRS, ruang ujian (opsional)",
  },
  {
    name: "Ujian Online",
    host: "ujiankampusa.bsi.ac.id",
    scope: "Jadwal UTS, UAS, Her, bukti ujian PDF",
  },
  {
    name: "Perpustakaan",
    host: "elibrary.bsi.ac.id",
    scope: "Katalog OPAC buku, stok, lokasi rak",
  },
  {
    name: "Berita Kampus",
    host: "news.bsi.ac.id",
    scope: "Pengumuman resmi kampus",
  },
  {
    name: "Repository",
    host: "repository.bsi.ac.id",
    scope: "Publikasi riset dan skripsi",
  },
];

interface FlowStep {
  code: string;
  title: string;
  description: string;
  meta: string;
  mascot: string;
  mascotAlt: string;
}

const FLOW_STEPS: FlowStep[] = [
  {
    code: "01",
    mascot: "/maskot/mura-empty.png",
    mascotAlt: "Maskot Mura: langkah masuk satu kali dengan akun MyBest",
    title: "Masuk sekali pakai akun MyBest",
    description:
      "Cukup masukkan NIM dan password MyBest. Puzzle geser login diselesaikan otomatis di server, password selalu disimpan terenkripsi, dan sesi aktif selama 7 hari. Tautan SIAKAD opsional dan bisa diaktifkan kapan saja dari Sesi & Keamanan.",
    meta: "Sesi aktif 7 hari · Tautan SIAKAD opsional · Login ulang otomatis",
  },
  {
    code: "02",
    mascot: "/maskot/mura-tugas-done.png",
    mascotAlt: "Maskot Mura: memantau jadwal, tugas, kuis, dan bahan ajar",
    title: "Jadwal, tugas, kuis, dan bahan ajar dalam satu tempat",
    description:
      "Jadwal mingguan, tenggat tugas, pengumpulan lembar jawaban, forum, kuis, hingga 5 paket bahan ajar resmi (Slide, Modul, Silabus, RPS, RTM) dipantau dari satu layar. Cache menjaga jadwal tetap terbaca saat portal kampus sibuk.",
    meta: "Bisa dipasang di HP & Desktop · Pratinjau materi langsung · Cadangan jadwal",
  },
  {
    code: "03",
    mascot: "/maskot/mura-presensi.png",
    mascotAlt: "Maskot Mura: mencatat presensi real-time dan notifikasi push",
    title: "Presensi, pengingat HP, dan komunitas mahasiswa",
    description:
      "Catat presensi kelas dengan verifikasi rekap dari server dan terima notifikasi push sebelum kelas dimulai atau saat deadline mendekat. Tersedia ruang Komunitas antarmahasiswa serta Kartu Flexing nilai tugas siap unduh.",
    meta: "Pengingat kelas & tugas · Ruang komunitas · Kartu nilai siap bagikan",
  },
];

const CONTRIBUTION_TOPICS = ["Parser Portal Kampus", "UI Mobile & PWA", "Testing & Bugfix"];

function formatCommits(count: number): string {
  return `${new Intl.NumberFormat("id-ID").format(count)} ${count === 1 ? "commit" : "commits"}`;
}

function avatarSrc(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}s=96`;
}

export function HowToUse({ contributors = [] }: { contributors?: RepositoryContributor[] }) {
  const totalCommits = contributors.reduce((sum, c) => sum + c.contributions, 0);
  const maxCommits = contributors[0]?.contributions || 1;

  return (
    <>
      <section
        id="cara-pakai"
        className="border-b-[1px] border-stroke bg-white scroll-mt-24"
        aria-labelledby="cara-pakai-title"
      >
      {/* Band 1: Asymmetric Editorial Workflow & 6-Portal Map */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
          {/* Left Sticky Column */}
          <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <RevealOnScroll>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0369A1]">
                CARA KERJA MIRA
              </p>
              <h2
                id="cara-pakai-title"
                className="mt-2.5 text-[clamp(1.5rem,3.2vw,2.2rem)] leading-[1.18] tracking-[-0.005em] text-foreground"
              >
                Bagaimana Mira menyatukan enam portal kampus
              </h2>
              <p className="mt-3.5 text-[13.5px] leading-[1.7] tracking-[0.012em] text-secondary sm:mt-4 sm:text-[14.5px]">
                Layanan kuliah UBSI tersebar di enam alamat berbeda. Mira menggabungkannya ke dalam
                satu sesi 7 hari, memperbarui login kampus secara otomatis saat kedaluwarsa, dan
                menyimpan cadangan data ketika server kampus sedang sibuk.
              </p>

              <div className="mt-6 divide-y-[1px] divide-stroke border-y-[1px] border-stroke sm:mt-7">
                {PORTALS.map((portal) => (
                  <div
                    key={portal.name}
                    className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-[150px_1fr] sm:items-baseline sm:gap-4 sm:py-3"
                  >
                    <div className="min-w-0">
                      <span className="block text-[13px] font-medium text-foreground sm:font-normal">
                        {portal.name}
                      </span>
                      <span className="block break-words font-mono text-[11px] text-[#0369A1]">
                        {portal.host}
                      </span>
                    </div>
                    <p className="min-w-0 text-[12.5px] leading-[1.55] text-secondary">
                      {portal.scope}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4 text-[13px]">
                <Link
                  href="/login"
                  className="inline-flex min-h-[42px] items-center justify-center rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-5 py-2 text-white transition-colors duration-200 hover:bg-white hover:text-[#072033]"
                >
                  Masuk akun kampus
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex min-h-[42px] items-center text-[#0369A1] underline underline-offset-4 transition-colors hover:text-[#075985]"
                >
                  Coba demo tanpa login
                </Link>
              </div>
            </RevealOnScroll>
          </div>

          {/* Right Editorial Flow Rows: compact inline mascot on mobile, 2-col on sm+ */}
          <ol className="min-w-0 divide-y-[1px] divide-stroke border-y-[1px] border-stroke">
            {FLOW_STEPS.map((step, idx) => (
              <li key={step.code} className="min-w-0">
                <RevealOnScroll delayMs={idx * 60}>
                  <div className="grid grid-cols-[56px_1fr] items-center gap-x-3.5 gap-y-2.5 py-5 sm:grid-cols-[104px_1fr] sm:gap-x-7 sm:gap-y-1 sm:py-8">
                    <ParallaxFrame className="h-14 w-14 shrink-0 sm:row-span-2 sm:h-24 sm:w-24 sm:self-center">
                      <Image
                        src={step.mascot}
                        alt={step.mascotAlt}
                        width={104}
                        height={104}
                        className="h-14 w-14 object-contain sm:h-24 sm:w-24"
                      />
                    </ParallaxFrame>
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] tracking-[0.14em] text-[#0369A1] sm:text-xs">
                        {step.code}
                      </span>
                      <h3 className="mt-0.5 text-[15.5px] font-medium leading-snug text-foreground sm:mt-1 sm:text-[18px] sm:font-normal sm:leading-[1.35] sm:tracking-[0.005em]">
                        {step.title}
                      </h3>
                    </div>
                    <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
                      <p className="text-[13px] leading-[1.7] tracking-[0.01em] text-secondary sm:mt-1.5 sm:text-[14px]">
                        {step.description}
                      </p>
                      <p className="mt-2.5 break-words font-mono text-[11px] leading-relaxed text-[#0369A1]">
                        {step.meta}
                      </p>
                    </div>
                  </div>
                </RevealOnScroll>
              </li>
            ))}
          </ol>
        </div>
      </div>
      </section>

      {/* Band 2: Open Source & Live GitHub Contributors */}
      <section
        id="kontribusi"
        aria-labelledby="kontribusi-title"
        className="border-b-[1px] border-stroke bg-background py-12 sm:py-20 scroll-mt-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-14">
            <RevealOnScroll className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0369A1]">
                OPEN SOURCE · LISENSI MIT
              </p>
              <h2
                id="kontribusi-title"
                className="mt-2 text-[clamp(1.45rem,2.8vw,2rem)] leading-[1.2] tracking-[-0.005em] text-foreground"
              >
                Dibangun terbuka bersama di GitHub.
              </h2>
              <p className="mt-3.5 text-[13.5px] leading-[1.75] text-secondary sm:text-[14.5px]">
                Mira dikembangkan oleh mahasiswa Informatika UBSI di bawah komunitas Muara AI.
                Seluruh kode sumber terbuka di GitHub agar bisa dipelajari, diaudit, dan
                disempurnakan bareng.
              </p>
              <p className="mt-3 text-[13.5px] leading-[1.75] text-secondary sm:text-[14.5px]">
                Nemu bug saat portal kampus berubah atau punya ide fitur baru? Buka Issue atau kirim
                Pull Request lewat branch baru di repositori resmi kami.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-4 py-2 text-xs font-medium text-white transition-colors duration-200 hover:bg-white hover:text-[#072033] sm:text-[13px]"
                >
                  <Github className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Buka GitHub</span>
                </a>
                <a
                  href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-[6px] border-[1px] border-stroke bg-white px-4 py-2 text-xs font-medium text-foreground transition-colors duration-200 hover:border-[#072033] sm:text-[13px]"
                >
                  <span>Panduan Kontribusi</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </a>
                <a
                  href={`${GITHUB_URL}/issues/new/choose`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[42px] items-center gap-1 px-1 text-xs text-[#0369A1] underline underline-offset-4 transition-colors hover:text-[#072033] sm:text-[13px]"
                >
                  <span>Laporkan Bug / Ide</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </a>
              </div>
            </RevealOnScroll>

            {/* Real GitHub Contributors Ledger */}
            <RevealOnScroll delayMs={80} className="min-w-0">
              <div
                id="kontributor"
                className="overflow-hidden rounded-[10px] border-[1px] border-stroke bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-[1px] border-stroke bg-[#FAFDFE] px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4 shrink-0 text-[#072033]" aria-hidden="true" />
                    <span className="text-[13.5px] font-medium text-foreground">
                      Kontributor GitHub
                    </span>
                  </div>
                  <a
                    href={`${GITHUB_URL}/graphs/contributors`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-[#0369A1] hover:underline tabular-nums"
                  >
                    {contributors.length > 0
                      ? `${contributors.length} orang · ${new Intl.NumberFormat("id-ID").format(totalCommits)} commits`
                      : "MuaraAI/Mira"}
                  </a>
                </div>

                {contributors.length > 0 ? (
                  <ul className="divide-y-[1px] divide-stroke">
                    {contributors.map((contributor) => {
                      const sharePct = Math.max(
                        6,
                        Math.round((contributor.contributions / maxCommits) * 100)
                      );
                      return (
                        <li key={contributor.login} className="min-w-0">
                          <a
                            href={contributor.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-[#FAFDFE] sm:px-5"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={avatarSrc(contributor.avatarUrl)}
                              alt={`Avatar GitHub ${contributor.login}`}
                              width={40}
                              height={40}
                              loading="lazy"
                              decoding="async"
                              className="h-10 w-10 shrink-0 rounded-[9999px] border-[1px] border-stroke bg-[#F0F7FB] object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-[14px] font-medium text-foreground group-hover:text-[#0369A1]">
                                  @{contributor.login}
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11.5px] text-secondary tabular-nums">
                                  <span>{formatCommits(contributor.contributions)}</span>
                                  <ArrowUpRight
                                    className="h-3.5 w-3.5 opacity-50 transition-opacity group-hover:text-[#0369A1] group-hover:opacity-100"
                                    aria-hidden="true"
                                  />
                                </span>
                              </div>
                              <div className="mt-1.5 flex items-center gap-2.5">
                                <div className="h-[3px] flex-1 overflow-hidden rounded-[9999px] bg-[#EAF3F9]">
                                  <div
                                    className="h-full rounded-[9999px] bg-[#0369A1] transition-all duration-300 group-hover:bg-[#072033]"
                                    style={{ width: `${sharePct}%` }}
                                  />
                                </div>
                                <span className="hidden font-mono text-[10px] text-secondary/75 sm:inline">
                                  github.com/{contributor.login}
                                </span>
                              </div>
                            </div>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-4 py-6 text-center text-xs text-secondary sm:px-5">
                    Daftar kontributor akan dimuat otomatis dari GitHub MuaraAI/Mira.
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 border-t-[1px] border-stroke bg-[#FAFDFE] px-4 py-3 sm:px-5">
                  <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
                    Fokus:
                  </span>
                  {CONTRIBUTION_TOPICS.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-[9999px] border-[1px] border-stroke bg-white px-2.5 py-0.5 text-[11px] text-secondary"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>
    </>
  );
}
