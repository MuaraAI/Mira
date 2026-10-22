import Link from "next/link";
import { BellRing, BookOpen, CalendarDays, CheckSquare, GraduationCap, UserCheck } from "lucide-react";
import { API_DOCS_URL } from "@/lib/public-links";

const features = [
  { icon: CalendarDays, title: "Jadwal kuliah", text: "Kelas hari ini dan besok, lengkap dengan ruang dan dosennya." },
  { icon: CheckSquare, title: "Tugas", text: "Deadline, soal, dan kumpulin link langsung dari sini." },
  { icon: UserCheck, title: "Absen", text: "Absen dari dashboard, statusnya update sendiri." },
  { icon: BookOpen, title: "Bahan ajar", text: "Materi dosen bisa dilihat dan diringkas otomatis." },
  { icon: GraduationCap, title: "Nilai dan KHS", text: "IPK, nilai per mata kuliah, KRS, dan kartu ujian." },
  { icon: BellRing, title: "Pengingat", text: "Notifikasi kelas, absen, dan tugas ke HP, Discord, atau Telegram." },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b-2 border-px-soft" aria-labelledby="hero-title">
      <div className="pointer-events-none absolute -right-24 top-12 h-72 w-72 bg-sky-100/50 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)] lg:gap-16 lg:px-8">
        <div className="stagger-rise min-w-0">
          <h1 id="hero-title" className="max-w-3xl font-display text-[2.3rem] font-bold leading-[1.06] tracking-[-0.04em] text-foreground min-[400px]:text-5xl sm:text-6xl">
            <span className="line-mask"><span style={{ ["--i" as string]: 0 }}>Cek jadwal, tugas,</span></span>
            <span className="line-mask"><span style={{ ["--i" as string]: 1 }}>absen, dan nilai</span></span>
            <span className="line-mask">
              <span className="text-[#0369A1]" style={{ ["--i" as string]: 2 }}>
                di satu tempat.<span className="px-cursor ml-1 inline-block h-[0.8em] w-[0.4em] translate-y-[0.06em] bg-[#0369A1]" aria-hidden="true" />
              </span>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-secondary sm:text-lg">
            Login pakai akun SIAKAD dan MyBest kamu, semuanya langsung kelihatan. Nggak perlu lagi bolak-balik buka dua web kampus.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap">
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
              Lihat API Docs
            </a>
          </div>

          <p className="mt-6 max-w-md text-sm leading-6 text-secondary">
            Gratis dan open source. Proyek independen dari Muara AI, bukan aplikasi resmi UBSI.
          </p>
        </div>

        <section id="fitur" className="current-surface min-w-0 scroll-mt-28" aria-labelledby="fitur-title">
          <div className="flex items-center gap-1.5 border-b-2 border-px-soft bg-px-tint px-4 py-2.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 bg-[#BE123C]" />
            <span className="h-2.5 w-2.5 bg-px-sun" />
            <span className="h-2.5 w-2.5 bg-[#0F766E]" />
          </div>
          <div className="p-5 sm:p-7">
            <h2 id="fitur-title" className="font-display text-xl font-semibold text-foreground">
              Yang bisa kamu lakukan
            </h2>
            <ul className="mt-5 divide-y-2 divide-dashed divide-px-soft">
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
                  <span className="px-icon mt-0.5 h-9 w-9 shrink-0">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-secondary">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </section>
  );
}
