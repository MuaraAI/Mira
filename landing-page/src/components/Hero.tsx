import Image from "next/image";
import Link from "next/link";
import { ParallaxHero, ParallaxLayer, RevealOnScroll, ScrubRevealText } from "./HomeParallax";
import { InstallAppButton } from "./InstallAppButton";

const DAILY_FLOWS = [
  {
    code: "01",
    title: "Jadwal Kuliah",
    text: "Jadwal mingguan dari MyBest, lengkap dengan ruang, jam, dan nama dosen pengampu.",
  },
  {
    code: "02",
    title: "MyBest: Tugas & Kuis",
    text: "Deadline tugas, kumpulkan lembar tugas, pantau kuis, dan unduh 5 paket bahan ajar resmi: Slide, Modul, Silabus, RPS, RTM.",
  },
  {
    code: "03",
    title: "Presensi Real-time",
    text: "Presensi kehadiran perkuliahan dengan verifikasi rekap otomatis dari server.",
  },
];

const SUPPORT_FLOWS = [
  {
    code: "04",
    title: "Ujian Online & Nilai",
    text: "Jadwal ujian kampus (Latihan, UTS, UAS), kartu ujian, KHS, dan IPK semester.",
  },
  {
    code: "05",
    title: "Perpustakaan & Repository",
    text: "Pencarian katalog buku fisik OPAC perpustakaan, materi dosen, dan repositori skripsi.",
  },
  {
    code: "06",
    title: "Notifikasi Pengingat",
    text: "Pengingat kelas, presensi, dan deadline tugas langsung ke layar HP, Discord, atau Telegram.",
  },
];

export function Hero() {
  return (
    <>
      <ParallaxHero
        className="relative flex min-h-0 flex-col justify-start overflow-hidden pb-14 pt-[86px] sm:min-h-[min(86dvh,700px)] sm:justify-end sm:pb-16 sm:pt-28"
        ariaLabelledBy="hero-title"
      >
        <div
          data-parallax-bg
          className="pointer-events-none absolute -inset-[8%] origin-center will-change-transform"
          aria-hidden="true"
        >
          <Image
            src="/images/hero-ocean-muara.webp"
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className="select-none object-cover object-center"
            aria-hidden="true"
          />
        </div>

        {/* Multi-stop cubic ease-out scrim untuk transisi halus tanpa banding ke #F7FAFC. */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            backgroundImage: [
              "linear-gradient(to top, #F7FAFC 0%, rgba(247, 250, 252, 0.93) 3%, rgba(247, 250, 252, 0.80) 6%, rgba(247, 250, 252, 0.62) 10%, rgba(247, 250, 252, 0.42) 14%, rgba(247, 250, 252, 0.24) 18%, rgba(247, 250, 252, 0.11) 22%, rgba(247, 250, 252, 0.03) 26%, rgba(247, 250, 252, 0) 30%)",
              "linear-gradient(to bottom, rgba(7, 32, 51, 0.56) 0%, rgba(7, 32, 51, 0.22) 14%, rgba(7, 32, 51, 0) 30%)",
              "linear-gradient(105deg, rgba(7, 32, 51, 0.88) 0%, rgba(7, 32, 51, 0.64) 52%, rgba(7, 32, 51, 0.28) 100%)",
            ].join(", "),
          }}
        />

        <div
          data-parallax-fg
          className="relative z-10 mx-auto w-full max-w-7xl px-5 will-change-transform sm:px-6 lg:px-8"
        >
          <div className="stagger-rise max-w-2xl">
            <h1
              id="hero-title"
              className="font-home-display text-[clamp(2rem,7.2vw,4.15rem)] leading-[1.08] tracking-[0.005em] text-white"
            >
              Alternatif all-in-one website UBSI,{" "}
              <span className="text-[#7DD3FC]">tanpa ribet.</span>
            </h1>

            <p className="mt-4 max-w-xl text-[14px] leading-[1.7] tracking-[0.01em] text-[#DCEBF5] sm:mt-5 sm:text-[15.5px]">
              Cek jadwal, tugas, absen, sampai nilai di satu tampilan yang rapi dan ramah dipakai.
              Login sekali pakai akun kampus, nggak perlu bolak-balik buka banyak portal.
            </p>

            <div className="mt-7 flex flex-col gap-3 min-[440px]:flex-row min-[440px]:flex-wrap min-[440px]:items-center sm:mt-8 sm:gap-3.5">
              <Link
                href="/login"
                className="inline-flex min-h-[46px] items-center justify-center rounded-[6px] border-[1px] border-white bg-white px-6 py-2.5 text-[13px] font-medium tracking-[0.015em] text-[#072033] transition-colors duration-200 hover:bg-transparent hover:text-white"
              >
                Masuk ke Dashboard
              </Link>
              <InstallAppButton className="inline-flex min-h-[46px] items-center justify-center rounded-[6px] border-[1px] border-white/75 bg-transparent px-6 py-2.5 text-[13px] font-medium tracking-[0.015em] text-white transition-colors duration-200 hover:border-white hover:bg-white hover:text-[#072033]" />
            </div>

            <div className="mt-4">
              <Link
                href="/demo"
                className="inline-flex min-h-[36px] items-center text-[13px] text-[#BAE6FD] underline underline-offset-4 transition-colors hover:text-white"
              >
                Coba Demo Dashboard tanpa login
              </Link>
            </div>
          </div>
        </div>
      </ParallaxHero>

      <section
        id="fitur"
        className="border-b-[1px] border-stroke bg-background py-12 sm:py-20 scroll-mt-24"
        aria-labelledby="fitur-title"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2
                id="fitur-title"
                className="text-[clamp(1.55rem,3.2vw,2.2rem)] leading-[1.18] tracking-[-0.005em] text-foreground"
              >
                Yang bisa kamu lakukan
              </h2>
              <ScrubRevealText
                text="Dari agenda kuliah harian sampai arsip skripsi, semua dirangkum agar kamu langsung lihat hal yang perlu dikerjakan hari ini."
                className="mt-3 max-w-md text-[13.5px] leading-[1.7] tracking-[0.012em] text-secondary sm:mt-4 sm:text-[14.5px]"
              />
              <Link
                href="/demo"
                className="mt-4 inline-flex min-h-[40px] items-center text-[13px] tracking-[0.012em] text-[#0369A1] underline underline-offset-4 transition-colors hover:text-[#075985] sm:mt-5"
              >
                Lihat tampilan dashboard
              </Link>
            </div>

            {/* Mobile: unified 01-06 list without mismatched gray box */}
            <div className="min-w-0 divide-y-[1px] divide-stroke border-y-[1px] border-stroke lg:hidden">
              {[...DAILY_FLOWS, ...SUPPORT_FLOWS].map((item) => (
                <div key={item.code} className="grid grid-cols-[28px_1fr] items-baseline gap-3 py-4">
                  <span className="font-mono text-[11px] tracking-[0.12em] text-[#0369A1]">
                    {item.code}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium leading-snug text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-[1.65] text-secondary">
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop top tier: 01-03 beside sticky intro */}
            <div className="hidden min-w-0 divide-y-[1px] divide-stroke border-y-[1px] border-stroke lg:block">
              {DAILY_FLOWS.map((item, idx) => (
                <RevealOnScroll key={item.code} delayMs={idx * 70}>
                  <div className="grid grid-cols-[56px_1fr] items-baseline gap-6 py-6">
                    <span className="font-mono text-xs tracking-[0.14em] text-[#0369A1]">
                      {item.code}
                    </span>
                    <div>
                      <h3 className="text-[16.5px] tracking-[0.005em] text-foreground">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-[13.5px] leading-[1.75] tracking-[0.012em] text-secondary">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>

          {/* Desktop bottom tier: 04-06 full-width unified architectural strip (no mismatched gray box) */}
          <ParallaxLayer speed={14} desktopOnly className="hidden lg:block">
            <RevealOnScroll delayMs={100}>
              <div className="mt-12 border-y-[1px] border-stroke">
                <div className="grid grid-cols-3 divide-x-[1px] divide-stroke">
                  {SUPPORT_FLOWS.map((item) => (
                    <div key={item.code} className="min-w-0 px-7 py-7 first:pl-0 last:pr-0">
                      <span className="font-mono text-xs tracking-[0.14em] text-[#0369A1]">
                        {item.code}
                      </span>
                      <h3 className="mt-2.5 text-[15.5px] tracking-[0.005em] text-foreground">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-[13px] leading-[1.7] tracking-[0.012em] text-secondary">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          </ParallaxLayer>
        </div>
      </section>
    </>
  );
}
