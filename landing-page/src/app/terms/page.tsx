import Link from "next/link";
import type { Metadata } from "next";
import { Monogram } from "@/components/Monogram";

export const metadata: Metadata = {
  title: "Syarat dan Ketentuan Layanan",
  description:
    "Aturan penggunaan Mira: hanya data milik sendiri, dilarang otomasi akademik terlarang, batas rate limit, dan hak kami untuk membatasi akun yang menyalahgunakan layanan.",
  alternates: { canonical: "https://mira.muaraai.com/terms" },
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Penerimaan Ketentuan",
    body: [
      "Dengan membuat akun, login, atau memakai dashboard dan API Mira, Anda setuju pada seluruh ketentuan di halaman ini serta Kebijakan Privasi kami.",
      "Layanan ini disediakan gratis untuk kalangan mahasiswa UBSI sebagai proyek komunitas Muara AI.",
    ],
  },
  {
    title: "2. Layanan yang Kami Sediakan",
    body: [
      "Dashboard mahasiswa: ringkasan akademik, jadwal, tugas, presensi, bahan ajar, nilai dan KHS, KRS, kartu ujian, berita kampus, dan pencarian perpustakaan.",
      "REST API dan MCP Server untuk otomasi pribadi (bot, skrip, AI agent) memakai Personal API Key milik Anda.",
      "Notifikasi webhook opsional ke Discord, Telegram, atau endpoint pribadi yang Anda daftarkan.",
    ],
  },
  {
    title: "3. Aturan Penggunaan yang Wajib Dipatuhi",
    body: [
      "Hanya data milik sendiri: Anda wajib login memakai NIM dan password kampus milik Anda sendiri. Mengumpulkan, memakai, atau menyimpan kredensial mahasiswa lain adalah pelanggaran berat.",
      "Larangan otomasi akademik terlarang: layanan ini read-only. Menggunakan API untuk manipulasi presensi, submit kuis/tugas otomatis, atau aktivitas yang melanggar regulasi akademik kampus dilarang keras dan berakibat pemblokiran permanen.",
      "Dilarang menyalahgunakan infrastruktur: tidak boleh melakukan scraping massal, menjual kembali akses API, mencoba menembus rate limit, menyerang endpoint, atau membebani server kampus melalui layanan ini.",
      "Dilarang menyebarkan malware, konten ilegal, atau memanfaatkan webhook untuk spam.",
    ],
  },
  {
    title: "4. Batas Layanan",
    body: [
      "Login: maksimum 5 percobaan per menit per NIM.",
      "API: maksimum 60 permintaan per menit per klien (Master Key internal dikecualikan).",
      "Personal API Key: maksimum 5 key aktif per akun; webhook: maksimum 5 channel aktif per akun.",
      "Sesi aktif 7 hari dengan perpanjangan otomatis selama akun digunakan.",
    ],
  },
  {
    title: "5. Ketersediaan dan Perubahan Layanan",
    body: [
      "Layanan bergantung pada portal resmi kampus. Jika server kampus down, mengubah struktur halaman, atau memblokir akses, sebagian fitur bisa terganggu tanpa pemberitahuan.",
      "Kami berhak menambah, mengubah, atau menghentikan fitur kapan saja. Perubahan material pada ketentuan ini akan disampaikan lewat halaman ini dengan tanggal berlaku baru.",
    ],
  },
  {
    title: "6. Pemblokiran dan Penghentian Akun",
    body: [
      "Pelanggaran pada poin 3 dapat berakibat: pencabutan sesi dan API key, pemblokiran NIM dari layanan, dan pelaporan ke pihak kampus bila menyangkut kecurangan akademik.",
      "Anda bisa berhenti memakai layanan kapan saja dengan melakukan logout dan mencabut seluruh API Key Anda.",
    ],
  },
  {
    title: "7. Sangguman (Disclaimer)",
    body: [
      "Layanan disediakan sebagaimana adanya (as is) tanpa jaminan apa pun. Kami tidak bertanggung jawab atas kehilangan data, kesalahan tampilan nilai, atau kerugian akademik apa pun yang timbul dari penggunaan layanan.",
      "Proyek ini independen dan tidak berafiliasi dengan Universitas Bina Sarana Informatika. Seluruh merek dan data akademik adalah milik masing-masing pemiliknya.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-stroke bg-white/60 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Monogram className="w-7 h-7" />
            <span className="font-display font-bold text-sm text-foreground">Mira</span>
          </Link>
          <Link
            href="/login"
            className="text-xs font-semibold text-[#0369A1] hover:underline"
          >
            Masuk ke Dashboard
          </Link>
        </div>
      </header>

      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-xs font-mono uppercase tracking-widest text-[#0369A1] font-bold">
          Legal
        </p>
        <h1 className="mt-1 text-3xl font-display font-bold tracking-tight text-foreground">
          Syarat dan Ketentuan Layanan
        </h1>
        <p className="mt-2 text-sm text-secondary">
          Berlaku sejak 18 Oktober 2026. Dibuat untuk melindungi Anda, sesama
          mahasiswa, dan server kampus.
        </p>

        <div className="mt-8 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title} aria-labelledby={`t-${s.title.slice(0, 8)}`}>
              <h2
                id={`t-${s.title.slice(0, 8)}`}
                className="text-lg font-display font-bold text-foreground tracking-tight"
              >
                {s.title}
              </h2>
              <ul className="mt-3 space-y-2.5">
                {s.body.map((p, i) => (
                  <li
                    key={i}
                    className="text-sm text-secondary leading-relaxed flex gap-2.5"
                  >
                    <span
                      className="mt-2 h-1.5 w-1.5 rounded-full bg-[#0369A1]/60 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section aria-labelledby="t-kontak">
            <h2
              id="t-kontak"
              className="text-lg font-display font-bold text-foreground tracking-tight"
            >
              8. Kontak
            </h2>
            <p className="mt-3 text-sm text-secondary leading-relaxed">
              Pertanyaan tentang ketentuan ini:{" "}
              <a
                href="mailto:admin@muaraai.com"
                className="text-[#0369A1] font-semibold hover:underline"
              >
                admin@muaraai.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-stroke flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <Link href="/privacy" className="font-semibold text-[#0369A1] hover:underline">
            Kebijakan Privasi
          </Link>
          <Link href="/" className="text-secondary hover:text-foreground">
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    </div>
  );
}
