import Link from "next/link";
import type { Metadata } from "next";
import { Monogram } from "@/components/Monogram";

export const metadata: Metadata = {
  title: "DMCA dan Hak Kekayaan Intelektual | UBSI API",
  description:
    "Pemberitahuan hak cipta, kekayaan intelektual, dan prosedur notice and takedown untuk proyek UBSI API.",
  alternates: { canonical: "https://ubsi-api.muaraai.com/dmca" },
};

const SECTIONS = [
  {
    title: "1. Ruang Lingkup",
    body: [
      "UBSI API adalah proyek perangkat lunak independen untuk membantu pengguna yang berwenang mengakses layanan akademik melalui dashboard, REST API, dan MCP.",
      "Halaman ini menjelaskan cara menyampaikan keberatan terkait hak cipta, merek, materi akademik, atau kebijakan institusi yang dikaitkan dengan proyek ini.",
    ],
  },
  {
    title: "2. Materi Pihak Ketiga",
    body: [
      "UBSI API tidak bermaksud mengklaim kepemilikan atas nama, merek, tampilan portal, materi kuliah, silabus, publikasi, atau data akademik milik Universitas Bina Sarana Informatika dan pemegang hak terkait.",
      "Layanan ini tidak menyediakan katalog publik sebagai pengganti sumber resmi, dan pengguna tetap harus menghormati ketentuan penggunaan serta hak pemilik sumber data.",
    ],
  },
  {
    title: "3. Pemberitahuan Pelanggaran",
    body: [
      "Jika Anda adalah pemilik hak atau perwakilan resmi dan meyakini bahwa repositori, situs, atau fitur UBSI API melanggar hak Anda, kirimkan pemberitahuan tertulis agar kami dapat meninjaunya.",
      "Pemberitahuan harus menjelaskan karya yang dipersoalkan, lokasi atau URL yang relevan, alasan keberatan, identitas dan kewenangan pengirim, serta alamat kontak yang bisa digunakan untuk verifikasi.",
      "Jangan kirim password kampus, Personal API Key, token sesi, atau data akademik mahasiswa dalam pemberitahuan.",
    ],
  },
  {
    title: "4. Peninjauan dan Tindakan",
    body: [
      "Setiap laporan akan ditinjau berdasarkan informasi yang tersedia dan kewenangan pengirim. Jika laporan terverifikasi, kami dapat memperbaiki atau menonaktifkan fitur terkait, menghapus referensi tertentu, membatasi akses, atau mengarsipkan repositori sesuai kebutuhan.",
      "Pengiriman laporan tidak otomatis berarti suatu materi dinyatakan melanggar. Kami dapat meminta klarifikasi tambahan sebelum mengambil keputusan.",
    ],
  },
  {
    title: "5. Kontak",
    body: [
      "Kirim pemberitahuan hak cipta, kekayaan intelektual, atau kebijakan institusi ke admin@muaraai.com.",
      "Anda juga dapat membuka issue atau menghubungi maintainer melalui GitHub. Sertakan hanya informasi yang diperlukan untuk memverifikasi laporan.",
    ],
  },
];

export default function DmcaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-stroke bg-white/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1] focus-visible:ring-offset-2">
            <Monogram className="h-7 w-7" />
            <span className="font-display text-sm font-bold text-foreground">UBSI API</span>
          </Link>
          <Link href="/login" className="text-xs font-semibold text-[#0369A1] hover:underline">Masuk ke Dashboard</Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#0369A1]">Legal</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">DMCA dan Hak Kekayaan Intelektual</h1>
        <p className="mt-2 text-sm text-secondary">Prosedur pemberitahuan hak cipta, kekayaan intelektual, dan kebijakan institusi untuk UBSI API.</p>

        <div className="mt-8 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title} aria-labelledby={section.title}>
              <h2 id={section.title} className="font-display text-lg font-bold tracking-tight text-foreground">{section.title}</h2>
              <ul className="mt-3 space-y-2.5">
                {section.body.map((paragraph) => (
                  <li key={paragraph} className="flex gap-2.5 text-sm leading-relaxed text-secondary">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0369A1]/60" aria-hidden="true" />
                    <span>{paragraph}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-stroke pt-6 text-xs">
          <Link href="/privacy" className="font-semibold text-[#0369A1] hover:underline">Kebijakan Privasi</Link>
          <Link href="/terms" className="font-semibold text-[#0369A1] hover:underline">Syarat dan Ketentuan</Link>
          <Link href="/" className="text-secondary hover:text-foreground">Kembali ke Beranda</Link>
        </div>
      </main>
    </div>
  );
}
