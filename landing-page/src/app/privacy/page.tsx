import Link from "next/link";
import type { Metadata } from "next";
import { Monogram } from "@/components/Monogram";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Bagaimana Mira memproses, mengenkripsi, dan menghapus data akademik Anda: AES-256-GCM, zero telemetry, dan kontrol penghapusan penuh di tangan Anda.",
  alternates: { canonical: "https://mira.muaraai.com/privacy" },
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Data yang Kami Proses",
    body: [
      "NIM (ID mahasiswa): untuk mengidentifikasi sesi dan data akademik Anda. Disimpan di Redis (sesi) dan SQLite (API key).",
      "Password kampus (SIAKAD dan MyBest): dipakai satu kali saat login untuk memverifikasi identitas, lalu disimpan terenkripsi AES-256-GCM di Redis agar sesi tetap hidup. Tidak pernah dikirim kembali ke browser dan tidak pernah ditulis sebagai teks biasa.",
      "Data akademik (jadwal, nilai, KHS, KRS, kartu ujian, presensi, tugas, bahan ajar): ditampilkan hanya kepada Anda dan disimpan sementara di cache Redis dengan TTL berjenjang (10 menit sampai 2 jam). Tidak pernah ditulis ke disk.",
      "Konfigurasi webhook (Discord/Telegram): Anda yang isi sendiri di dashboard, disimpan terenkripsi di SQLite untuk fitur notifikasi yang Anda aktifkan.",
      "Metadata Personal API Key: hanya hash-nya yang disimpan. Key utuh ditampilkan tepat satu kali saat dibuat.",
    ],
  },
  {
    title: "2. Bagaimana Kredensial Anda Dilindungi",
    body: [
      "Enkripsi AES-256-GCM: seluruh payload sesi (termasuk password kampus) dienkripsi dengan kunci 256-bit turunan dari master key server. Dump Redis hanya menghasilkan ciphertext, dan perubahan sembarang langsung ditolak oleh auth tag.",
      "Zero plaintext: password tidak pernah muncul di log, respons API, atau browser Anda setelah login.",
      "Cookie aman: sesi browser memakai cookie HttpOnly, Secure, SameSite=Lax yang tidak bisa dibaca JavaScript halaman.",
      "Rate limiting: login dibatasi 5 percobaan per menit per NIM; API dibatasi 60 permintaan per menit per klien.",
    ],
  },
  {
    title: "3. Yang Terjadi di Browser Anda",
    body: [
      "Dashboard menyimpan cache kecil di memori tab (3 menit) agar perpindahan halaman instan dan server kampus tidak dilewati berulang kali.",
      "Logout (perangkat ini atau semua perangkat) langsung membersihkan cache tersebut, jadi pengguna berikutnya di browser yang sama tidak bisa melihat data Anda.",
      "Token fallback untuk skrip bisa tersimpan di localStorage browser Anda; logout atau bersih-bersih data browser menghapusnya.",
    ],
  },
  {
    title: "4. Pihak Ketiga",
    body: [
      "Tidak ada analytics, tracker, iklan, atau telemetry. Layanan ini tidak melaporkan apa pun ke pihak lain.",
      "Satu-satunya traffic keluar adalah ke portal resmi kampus UBSI (untuk mengambil data akademik Anda sendiri) dan ke kanal notifikasi yang Anda konfigurasi sendiri (Discord/Telegram/webhook pribadi).",
    ],
  },
  {
    title: "5. Retensi dan Penghapusan Data",
    body: [
      "Logout perangkat ini: menghapus token sesi Anda dari Redis seketika.",
      "Logout semua perangkat: menghapus seluruh sesi yang pernah diterbitkan untuk NIM Anda.",
      "Kadaluarsa otomatis: sesi mati setelah 7 hari tanpa aktivitas (sliding, diperpanjang selama akun dipakai).",
      "Cache akademik: transien, habis dalam 10 menit sampai 2 jam, tidak pernah disimpan permanen.",
      "API key: mencabut key menghapusnya dari database seketika.",
    ],
  },
  {
    title: "6. Tanggung Jawab Anda",
    body: [
      "Gunakan hanya kredensial milik Anda sendiri. Layanan ini ada agar mahasiswa bisa membaca data akademiknya sendiri dengan nyaman. Mengumpulkan kredensial orang lain atau mengotomasi hal di luar pembacaan data adalah pelanggaran kebijakan ini dan Code of Conduct proyek.",
    ],
  },
  {
    title: "7. Disclaimer Institusi",
    body: [
      "Ini proyek independen buatan mahasiswa. Tidak berafiliasi dengan, tidak didukung oleh, dan tidak terhubung resmi dengan Universitas Bina Sarana Informatika. Seluruh data akademik tetap milik universitas dan hanya ditampilkan kembali kepada Anda, pemilik sah data tersebut.",
    ],
  },
];

export default function PrivacyPage() {
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
          Kebijakan Privasi
        </h1>
        <p className="mt-2 text-sm text-secondary">
          Berlaku sejak 18 Oktober 2026. Mencakup Mira, dashboard di
          mira.muaraai.com, dan gateway API di api.muaraai.com.
        </p>

        <div className="mt-8 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title} aria-labelledby={`p-${s.title.slice(0, 8)}`}>
              <h2
                id={`p-${s.title.slice(0, 8)}`}
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

          <section aria-labelledby="p-kontak">
            <h2
              id="p-kontak"
              className="text-lg font-display font-bold text-foreground tracking-tight"
            >
              8. Kontak
            </h2>
            <p className="mt-3 text-sm text-secondary leading-relaxed">
              Pertanyaan atau permintaan penghapusan data bisa disampaikan lewat
              email{" "}
              <a
                href="mailto:admin@muaraai.com"
                className="text-[#0369A1] font-semibold hover:underline"
              >
                admin@muaraai.com
              </a>{" "}
              atau issue di repo{" "}
              <a
                href="https://github.com/MuaraAI/Mira"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0369A1] font-semibold hover:underline"
              >
                github.com/MuaraAI/Mira
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-stroke flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <Link href="/terms" className="font-semibold text-[#0369A1] hover:underline">
            Terms of Service
          </Link>
          <Link href="/" className="text-secondary hover:text-foreground">
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    </div>
  );
}
