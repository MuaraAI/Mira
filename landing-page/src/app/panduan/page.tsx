import Link from "next/link";
import { Monogram } from "@/components/Monogram";
import { buildBreadcrumbJsonLd, buildPageMetadata, SITE_URL } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Panduan MyBest & SIAKAD UBSI di Mira",
  description:
    "Panduan lengkap mahasiswa UBSI di Mira: cara login MyBest, tautkan SIAKAD, absen kuliah, cek nilai KHS/IPK, unduh modul, dan atasi gagal login.",
  path: "/panduan",
});

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Beranda", path: "/" },
  { name: "Panduan Mahasiswa", path: "/panduan" },
]);

const HOWTO_STEPS = [
  {
    name: "Masuk dengan NIM dan password MyBest",
    text: "Buka halaman login Mira di mira.muaraai.com/login, masukkan NIM dan password akun elearning.bsi.ac.id. Server menyelesaikan puzzle geser MyBest otomatis dan menyimpan sesi aktif selama 7 hari.",
    url: `${SITE_URL}/panduan#login-mybest`,
  },
  {
    name: "Tautkan akun SIAKAD di menu Sesi & Keamanan",
    text: "Buka menu Sesi & Keamanan di dashboard untuk menautkan password SIAKAD (students.bsi.ac.id). Tautan disimpan terenkripsi per NIM sehingga KHS, KRS, transkrip, dan kartu ujian langsung aktif.",
    url: `${SITE_URL}/panduan#tautkan-siakad`,
  },
  {
    name: "Pantau jadwal kuliah dan catat presensi",
    text: "Buka halaman Jadwal Kuliah dan Presensi Kehadiran untuk melihat ruangan, jam, dosen pengampu, serta mengirim absen masuk ketika kelas dibuka.",
    url: `${SITE_URL}/panduan#presensi-jadwal`,
  },
  {
    name: "Pantau tugas dan unduh 5 paket bahan ajar",
    text: "Buka Tugas & Deadline, Forum Diskusi, Kuis Perkuliahan, dan Bahan Ajar untuk mengunduh Slide, Modul, Silabus, RPS, serta RTM resmi setiap mata kuliah.",
    url: `${SITE_URL}/panduan#tugas-materi-kuis`,
  },
  {
    name: "Cek nilai KHS/IPK, KRS, OPAC perpustakaan, dan skripsi",
    text: "Gunakan menu Nilai & KHS, Kartu KRS, Perpustakaan OPAC, dan Repository untuk mengecek IPK semester, mencetak KRS, mencari buku rak kampus, atau riset skripsi.",
    url: `${SITE_URL}/panduan#khs-krs-perpustakaan`,
  },
];

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Cara Mengakses MyBest, SIAKAD, dan Layanan Kampus UBSI lewat Mira",
  description:
    "Langkah praktis mahasiswa UBSI menghubungkan akun MyBest dan SIAKAD ke Mira untuk memantau jadwal, absen, tugas, materi, KHS, dan notifikasi kuliah.",
  inLanguage: "id-ID",
  step: HOWTO_STEPS.map((step, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: step.name,
    text: step.text,
    url: step.url,
  })),
};

const PANDUAN_FAQ = [
  {
    q: "Kenapa setelah login MyBest data KHS dan KRS belum muncul?",
    a: "Login utama Mira hanya memverifikasi akun MyBest (elearning.bsi.ac.id) karena banyak mahasiswa memakai password berbeda untuk SIAKAD. Untuk membuka data KHS, KRS, transkrip nilai murni, dan kontak prodi, buka menu Sesi & Keamanan di dashboard lalu tautkan password SIAKAD secara terpisah.",
  },
  {
    q: "Apakah password MyBest dan SIAKAD UBSI selalu sama?",
    a: "Tidak selalu. MyBest dan SIAKAD dikelola di dua server kampus yang berbeda. Jika kamu pernah mengubah password di salah satu portal atau melakukan reset password, pastikan kamu memasukkan password masing-masing portal yang masih berlaku.",
  },
  {
    q: "Kenapa tombol presensi tidak bisa dipakai saat ingin absen?",
    a: "Presensi mandiri hanya bisa dikirim ketika dosen atau sistem MyBest sedang membuka sesi absen kelas tersebut. Jika sesi belum dibuka, sudah ditutup, atau melewati jam kelas, status di Mira mengikuti kondisi server MyBest dan baru aktif saat sesi dibuka.",
  },
  {
    q: "Bagaimana cara mengunduh Slide, Modul, Silabus, RPS, dan RTM mata kuliah?",
    a: "Masuk ke dashboard Mira lalu buka menu Bahan Ajar & Modul. Pilih mata kuliah aktif untuk melihat materi pertemuan dari MyBest dan mengunduh arsip paket resmi Slide, Modul Lab, Silabus, RPS, maupun RTM.",
  },
  {
    q: "Bagaimana cara menyalakan pengingat jadwal kuliah dan deadline tugas di HP?",
    a: "Pasang Mira sebagai aplikasi PWA dari browser HP atau buka menu Notifikasi di dashboard untuk mengaktifkan Web Push. Kamu juga bisa menghubungkan webhook Discord atau Telegram agar pengingat kelas dan tenggat tugas masuk otomatis.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: PANDUAN_FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

const TOC_ITEMS = [
  { href: "#login-mybest", label: "1. Login MyBest" },
  { href: "#tautkan-siakad", label: "2. Tautkan SIAKAD" },
  { href: "#presensi-jadwal", label: "3. Jadwal & Presensi" },
  { href: "#tugas-materi-kuis", label: "4. Tugas & Bahan Ajar" },
  { href: "#khs-krs-perpustakaan", label: "5. KHS, KRS & OPAC" },
  { href: "#notifikasi-pwa", label: "6. PWA & Notifikasi" },
  { href: "#troubleshooting", label: "7. Solusi Masalah" },
  { href: "#faq-panduan", label: "FAQ Panduan" },
];

export default function PanduanPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-stroke bg-white/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Monogram className="h-7 w-7" />
            <span className="font-display text-sm font-bold text-foreground">Mira</span>
          </Link>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link href="/demo" className="text-secondary hover:text-foreground">
              Demo
            </Link>
            <Link href="/developers" className="text-secondary hover:text-foreground">
              API &amp; MCP
            </Link>
            <Link href="/login" className="text-[#0369A1] hover:underline">
              Masuk ke Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#0369A1]">
          Panduan Mahasiswa UBSI
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Panduan Lengkap MyBest &amp; SIAKAD UBSI di Mira
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-secondary sm:text-base">
          Pelajari cara masuk satu kali dengan akun MyBest, menautkan SIAKAD untuk KHS dan KRS,
          mengirim presensi kelas, mengunduh 5 paket bahan ajar, hingga mengatasi kendala login di
          enam layanan kampus UBSI.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="inline-flex min-h-[42px] items-center justify-center rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white hover:text-[#072033]"
          >
            Login Mahasiswa
          </Link>
          <Link
            href="/demo"
            className="inline-flex min-h-[42px] items-center justify-center rounded-[6px] border-[1px] border-stroke bg-white px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-[#072033]"
          >
            Coba Demo Tanpa Login
          </Link>
          <Link
            href="/lupa-password"
            className="inline-flex min-h-[42px] items-center px-1 text-xs font-medium text-[#0369A1] underline underline-offset-4 hover:text-[#075985]"
          >
            Lupa Password Kampus
          </Link>
        </div>

        <nav
          aria-label="Daftar isi panduan"
          className="mt-8 rounded-[8px] border border-stroke bg-white p-4 sm:p-5"
        >
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#0369A1]">
            Daftar Isi Panduan
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TOC_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex min-h-[34px] items-center rounded-[6px] border border-stroke bg-[#F0F7FB] px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-[#0369A1] hover:text-[#0369A1]"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="mt-10 space-y-10">
          <section id="login-mybest" aria-labelledby="h-login-mybest" className="scroll-mt-8">
            <h2
              id="h-login-mybest"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              1. Cara Login Akun MyBest UBSI
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Mira memakai pendekatan MyBest-first agar mahasiswa bisa langsung masuk tanpa perlu
              mengisi CAPTCHA secara manual atau menautkan portal lain terlebih dahulu.
            </p>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed text-secondary">
              <li>
                1. Buka halaman{" "}
                <Link href="/login" className="font-semibold text-[#0369A1] hover:underline">
                  mira.muaraai.com/login
                </Link>
                .
              </li>
              <li>
                2. Masukkan NIM mahasiswa UBSI dan password akun MyBest (
                <code className="font-mono text-xs text-foreground">elearning.bsi.ac.id</code>).
              </li>
              <li>
                3. Centang persetujuan Kebijakan Privasi dan Syarat Layanan, lalu klik Masuk ke
                Dashboard. Server menyelesaikan puzzle geser verifikasi MyBest secara otomatis.
              </li>
              <li>
                4. Sesi dashboard aktif selama 7 hari (sliding) dan diperpanjang otomatis selama
                aplikasi digunakan.
              </li>
            </ol>
          </section>

          <section id="tautkan-siakad" aria-labelledby="h-tautkan-siakad" className="scroll-mt-8">
            <h2
              id="h-tautkan-siakad"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              2. Cara Menautkan SIAKAD UBSI untuk KHS, KRS &amp; Kartu Ujian
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Portal SIAKAD (<code className="font-mono text-xs text-foreground">students.bsi.ac.id</code>)
              bersifat opsional. Karena sebagian mahasiswa memakai password SIAKAD yang berbeda dari
              MyBest, Mira tidak mewarisi password MyBest ke SIAKAD secara sepihak.
            </p>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed text-secondary">
              <li>
                1. Setelah masuk ke dashboard, buka menu{" "}
                <Link href="/dashboard/sesi" className="font-semibold text-[#0369A1] hover:underline">
                  Sesi &amp; Keamanan
                </Link>
                .
              </li>
              <li>
                2. Masukkan password SIAKAD pada formulir penautan. Server menyelesaikan CAPTCHA
                gambar SIAKAD otomatis di belakang layar untuk memverifikasi kredensial.
              </li>
              <li>
                3. Password SIAKAD disimpan terenkripsi Fernet per NIM secara kanonis, jadi ketika
                Anda berpindah perangkat atau login ulang, data SIAKAD tetap tertaut tanpa input
                ulang.
              </li>
            </ol>
          </section>

          <section id="presensi-jadwal" aria-labelledby="h-presensi-jadwal" className="scroll-mt-8">
            <h2
              id="h-presensi-jadwal"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              3. Cara Cek Jadwal Kuliah, Presensi Kehadiran &amp; Kuliah Pengganti
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-secondary">
              <li>
                Jadwal harian dan mingguan diambil dari MyBest beserta kode mata kuliah, SKS, jam,
                ruang kelas, nama dosen, dan jadwal kuliah pengganti.
              </li>
              <li>
                Di menu Presensi Kehadiran, Anda dapat melihat rekap pertemuan (tanggal, berita
                acara perkuliahan, rangkuman materi) sekaligus mengirim absen masuk saat sesi
                dibuka oleh dosen.
              </li>
              <li>
                Setiap presensi melalui Mira disertai verifikasi ulang ke server MyBest agar status
                kehadiran dipastikan tercatat di portal kampus.
              </li>
            </ul>
          </section>

          <section
            id="tugas-materi-kuis"
            aria-labelledby="h-tugas-materi-kuis"
            className="scroll-mt-8"
          >
            <h2
              id="h-tugas-materi-kuis"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              4. Cara Pantau Tugas, Unduh 5 Paket Bahan Ajar, Forum &amp; Kuis MyBest
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-secondary">
              <li>
                Menu Tugas &amp; Deadline menampilkan daftar tugas aktif, tenggat waktu, dan
                status pengumpulan. Anda juga dapat memantau komentar dan nilai tugas per
                pertemuan.
              </li>
              <li>
                Menu Bahan Ajar &amp; Modul merangkum video pembelajaran, slide, serta 5 paket
                berkas resmi (Slide, Modul, Silabus, RPS, dan RTM) per mata kuliah.
              </li>
              <li>
                Forum Diskusi dan Kuis Perkuliahan membantu Anda membaca instruksi dosen, melihat
                jadwal kuis aktif, serta memantau ujian di{" "}
                <code className="font-mono text-xs text-foreground">ujiankampusa.bsi.ac.id</code>.
              </li>
            </ul>
          </section>

          <section
            id="khs-krs-perpustakaan"
            aria-labelledby="h-khs-krs-perpustakaan"
            className="scroll-mt-8"
          >
            <h2
              id="h-khs-krs-perpustakaan"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              5. Cara Cek Nilai KHS/IPK, KRS, Perpustakaan OPAC &amp; Repository
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-secondary">
              <li>
                Menu Nilai &amp; KHS menampilkan transkrip SIAKAD (rincian Absen, Tugas, UTS, UAS,
                total nilai, dan grade) serta IPK dan KHS per semester.
              </li>
              <li>
                Menu Kartu KRS dan Jadwal &amp; Kartu Ujian merangkum mata kuliah terdaftar,
                kelompok ujian, serta jadwal UTS/UAS/HER dari SIAKAD dan Ujian Online.
              </li>
              <li>
                Layanan kampus publik seperti Perpustakaan OPAC (
                <code className="font-mono text-xs text-foreground">elibrary.bsi.ac.id</code>),
                Berita Resmi (<code className="font-mono text-xs text-foreground">news.bsi.ac.id</code>),
                dan Repository Skripsi (<code className="font-mono text-xs text-foreground">repository.bsi.ac.id</code>)
                bisa diakses langsung untuk mencari stok buku fisik dan referensi penelitian.
              </li>
            </ul>
          </section>

          <section id="notifikasi-pwa" aria-labelledby="h-notifikasi-pwa" className="scroll-mt-8">
            <h2
              id="h-notifikasi-pwa"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              6. Cara Pasang Aplikasi di HP (PWA) &amp; Pengingat Discord atau Telegram
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Mira dirancang sebagai Progressive Web App (PWA) yang responsif hingga layar HP 360px.
              Anda bisa menempelkan ikon Mira ke layar utama HP lewat opsi Tambah ke Layar Utama
              (Android Chrome atau Safari iOS) tanpa mengunduh file APK terpisah.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Di menu{" "}
              <Link
                href="/dashboard/notifikasi"
                className="font-semibold text-[#0369A1] hover:underline"
              >
                Notifikasi
              </Link>
              , aktifkan pengingat kelas dan deadline tugas melalui Web Push HP, atau tambahkan
              webhook pribadi Discord dan Telegram yang tersimpan terenkripsi di server. Untuk
              otomasi lanjutan dengan AI agent atau skrip pribadi, lihat dokumentasi{" "}
              <Link href="/developers" className="font-semibold text-[#0369A1] hover:underline">
                REST API &amp; MCP Server
              </Link>
              .
            </p>
          </section>

          <section
            id="troubleshooting"
            aria-labelledby="h-troubleshooting"
            className="scroll-mt-8"
          >
            <h2
              id="h-troubleshooting"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              7. Solusi Masalah Umum &amp; Gagal Login
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-[8px] border border-stroke bg-white p-4">
                <h3 className="font-display text-sm font-bold text-foreground">
                  Password MyBest atau SIAKAD ditolak
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                  Pastikan NIM berisi angka yang benar dan tidak ada spasi. Jika lupa kata sandi,
                  ajukan link reset langsung ke email terdaftar lewat halaman{" "}
                  <Link
                    href="/lupa-password"
                    className="font-semibold text-[#0369A1] hover:underline"
                  >
                    Lupa Password
                  </Link>
                  .
                </p>
              </div>

              <div className="min-w-0 rounded-[8px] border border-stroke bg-white p-4">
                <h3 className="font-display text-sm font-bold text-foreground">
                  Pesan SIAKAD_RELINK_REQUIRED (409)
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                  Terjadi jika Anda baru mengganti password SIAKAD di situs kampus. Buka menu Sesi
                  &amp; Keamanan di dashboard lalu tautkan ulang password SIAKAD terbaru.
                </p>
              </div>

              <div className="min-w-0 rounded-[8px] border border-stroke bg-white p-4">
                <h3 className="font-display text-sm font-bold text-foreground">
                  Batas percobaan login (Rate Limit 429)
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                  Demi menjaga stabilitas server kampus, login dibatasi 10 percobaan per menit per
                  IP. Tunggu sampai hitungan mundur berakhir sebelum mencoba masuk kembali.
                </p>
              </div>

              <div className="min-w-0 rounded-[8px] border border-stroke bg-white p-4">
                <h3 className="font-display text-sm font-bold text-foreground">
                  Server kampus lambat atau sibuk
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                  Mira menyimpan cadangan sementara di cache Redis (SWR Last-Known-Good) agar jadwal
                  kuliah dan catatan penting tetap bisa dibuka meskipun portal kampus sedang padat.
                </p>
              </div>
            </div>
          </section>

          <section id="faq-panduan" aria-labelledby="h-faq-panduan" className="scroll-mt-8">
            <h2
              id="h-faq-panduan"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              Pertanyaan Umum Penggunaan Mira
            </h2>
            <dl className="mt-4 divide-y divide-stroke overflow-hidden rounded-[8px] border border-stroke bg-white">
              {PANDUAN_FAQ.map((item) => (
                <div key={item.q} className="p-4 sm:p-5">
                  <dt className="font-display text-sm font-bold text-foreground sm:text-[15px]">
                    {item.q}
                  </dt>
                  <dd className="mt-1.5 text-xs leading-relaxed text-secondary sm:text-sm">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-stroke pt-6 text-xs">
          <Link href="/demo" className="font-semibold text-[#0369A1] hover:underline">
            Demo Dashboard
          </Link>
          <Link href="/developers" className="font-semibold text-[#0369A1] hover:underline">
            REST API &amp; MCP
          </Link>
          <Link href="/lupa-password" className="font-semibold text-[#0369A1] hover:underline">
            Lupa Password
          </Link>
          <Link href="/privacy" className="font-semibold text-[#0369A1] hover:underline">
            Kebijakan Privasi
          </Link>
          <Link href="/terms" className="font-semibold text-[#0369A1] hover:underline">
            Syarat dan Ketentuan
          </Link>
          <Link href="/dmca" className="font-semibold text-[#0369A1] hover:underline">
            DMCA dan HKI
          </Link>
          <Link href="/" className="text-secondary hover:text-foreground">
            Kembali ke Beranda
          </Link>
        </div>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </div>
  );
}
