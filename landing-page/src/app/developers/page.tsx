import Link from "next/link";
import { Monogram } from "@/components/Monogram";
import { API_BASE_URL, API_DOCS_URL, GITHUB_URL, MCP_URL } from "@/lib/public-links";
import { buildBreadcrumbJsonLd, buildPageMetadata, SITE_URL } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "REST API & MCP Server UBSI (42 Tools)",
  description:
    "Dokumentasi pengembang Mira UBSI: integrasikan REST API akademik dan server MCP 42 tools mira_* untuk Claude Code, Cursor, Codex, dan bot mahasiswa.",
  path: "/developers",
});

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Beranda", path: "/" },
  { name: "REST API & MCP", path: "/developers" },
]);

const techArticleJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "REST API & MCP Server Mira UBSI (42 Tools)",
  description:
    "Panduan autentikasi Personal API Key, contoh pemanggilan REST API, konfigurasi MCP Streamable HTTP untuk AI agent, serta katalog 42 tools mira_*.",
  url: `${SITE_URL}/developers`,
  inLanguage: "id-ID",
  author: { "@id": `${SITE_URL}/#organization` },
  publisher: { "@id": `${SITE_URL}/#organization` },
};

const CURL_EXAMPLE = `curl -s "${API_BASE_URL}/v1/elearning/courses" \\
  -H "Authorization: Bearer muara_mira_YOUR_KEY"`;

const ENVELOPE_EXAMPLE = `{
  "success": true,
  "data": [...],
  "cached": false
}`;

const MCP_SNIPPETS = [
  {
    client: "Claude Code CLI",
    code: `claude mcp add --transport http mira-academic \\
  ${MCP_URL} \\
  --header "Authorization: Bearer muara_mira_YOUR_KEY"`,
  },
  {
    client: "Cursor IDE (.cursor/mcp.json)",
    code: `{
  "mcpServers": {
    "mira-academic": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer muara_mira_YOUR_KEY"
      }
    }
  }
}`,
  },
  {
    client: "Codex CLI (~/.codex/config.toml)",
    code: `[mcp_servers.mira-academic]
url = "${MCP_URL}"
http_headers = { "Authorization" = "Bearer muara_mira_YOUR_KEY" }`,
  },
  {
    client: "Hermes Agent (~/.hermes/config.yaml)",
    code: `mcp_servers:
  mira-academic:
    url: ${MCP_URL}
    headers:
      Authorization: "Bearer muara_mira_YOUR_KEY"`,
  },
];

const TOOL_GROUPS = [
  {
    name: "Kategori A: SIAKAD students.bsi.ac.id (12 Tools)",
    note: "Membutuhkan akun SIAKAD yang sudah ditautkan di menu Sesi & Keamanan.",
    tools: [
      { id: "mira_get_profile", desc: "Biodata akademik mahasiswa (NIM, prodi, kelas, semester, kampus, dosen PA)." },
      { id: "mira_get_schedule", desc: "Jadwal kuliah aktif: hari, jam, ruang, SKS, kode dosen, dan praktikum." },
      { id: "mira_get_grades", desc: "Transkrip nilai murni SIAKAD (Absen 20%, Tugas 25%, UTS 25%, UAS 30%)." },
      { id: "mira_get_khs", desc: "Kartu Hasil Studi per semester, IPK kumulatif, mutu poin, dan SKS lulus." },
      { id: "mira_get_krs", desc: "Kartu Rencana Studi semester berjalan beserta kelompok ujian." },
      { id: "mira_get_uts", desc: "Jadwal ruang UTS online dan tautan berkas UTS." },
      { id: "mira_get_uas", desc: "Jadwal ruang UAS online dan tautan berkas UAS." },
      { id: "mira_get_academic_calendar", desc: "Tautan PDF resmi Kalender Akademik tahun ajaran berjalan." },
      { id: "mira_get_prodi_contacts", desc: "Direktori 51 kontak resmi Dekan dan Ketua Program Studi UBSI." },
      { id: "mira_get_certificates", desc: "Daftar sertifikat pelatihan, kegiatan, Course, dan TOEFL mahasiswa." },
      { id: "mira_get_lecturers", desc: "Cari direktori 1.350+ dosen UBSI berdasarkan inisial kode atau nama." },
      { id: "mira_get_dashboard", desc: "Agregasi paralel jadwal, nilai, berita, dan pengumuman SIAKAD." },
    ],
  },
  {
    name: "Kategori B: Elearning MyBest elearning.bsi.ac.id (23 Tools)",
    note: "Menggunakan token kursus terenkripsi Laravel (eyJ...) dari mira_get_courses.",
    tools: [
      { id: "mira_get_courses", desc: "Daftar mata kuliah aktif lengkap dengan token absen, materi, tugas, dan diskusi." },
      { id: "mira_get_assignments", desc: "Daftar tugas aktif dan riwayat pengumpulan mahasiswa." },
      { id: "mira_submit_assignment", desc: "[WRITE] Kirim atau perbarui tautan tugas (Google Drive atau GitHub)." },
      { id: "mira_upload_assignment", desc: "[WRITE] Unggah berkas tugas mandiri base64 (maks 10MB decoded)." },
      { id: "mira_get_presence", desc: "Rekap kehadiran real-time dan riwayat BAP perkuliahan." },
      { id: "mira_submit_presence", desc: "[WRITE] Catat presensi masuk saat sesi kelas membuka absen." },
      { id: "mira_get_materials", desc: "Unduh paket arsip resmi ZIP Silabus, RPS, RTM, Slide, dan Modul." },
      { id: "mira_get_learning_media", desc: "Video pembelajaran dan dokumen slide pada halaman /learning." },
      { id: "mira_submit_teaching_feedback", desc: "[WRITE] Kirim komentar pengajaran dosen pada sesi absen." },
      { id: "mira_get_quiz", desc: "Daftar kuis latihan dan ujian online MyBest." },
      { id: "mira_get_quiz_questions", desc: "Pratinjau soal kuis pilihan ganda beserta sisa waktu hitung mundur." },
      { id: "mira_get_exams", desc: "Daftar jenis ujian Ujian Online BSI (latihan, UTS, UAS, HER, pengganti)." },
      { id: "mira_get_exam_schedule", desc: "Jadwal ruang, tanggal, durasi, dan status ujian online per jenis." },
      { id: "mira_submit_quiz_answer", desc: "[WRITE] Kirim pilihan jawaban butir soal kuis." },
      { id: "mira_get_grades_recap", desc: "Rekap nilai tugas dan kuis per pertemuan beserta catatan dosen." },
      { id: "mira_get_course_grades", desc: "Rincian nilai tugas satu mata kuliah tertentu." },
      { id: "mira_get_discussions", desc: "Daftar topik forum diskusi dan instruksi tugas per mata kuliah." },
      { id: "mira_get_discussion_comments", desc: "Baca utas komentar lengkap mahasiswa dan dosen di forum." },
      { id: "mira_submit_discussion_comment", desc: "[WRITE] Kirim balasan atau komentar ke forum diskusi." },
      { id: "mira_create_discussion", desc: "[WRITE] Buat topik forum diskusi baru pada mata kuliah." },
      { id: "mira_get_elearning_profile", desc: "Profil dan alamat email yang terhubung ke akun MyBest." },
      { id: "mira_get_makeup_classes", desc: "Jadwal kuliah pengganti yang terdaftar di MyBest." },
      { id: "mira_get_elearning_guides", desc: "Tautan PDF panduan resmi MyBest, Ujian Online, dan Kuis." },
    ],
  },
  {
    name: "Kategori C: Perpustakaan, Berita & Repository (3 Tools)",
    note: "Akses katalog publik perpustakaan OPAC, berita resmi, dan repositori skripsi.",
    tools: [
      { id: "mira_search_library", desc: "Cari stok buku fisik dan nomor rak di katalog OPAC perpustakaan UBSI." },
      { id: "mira_get_news", desc: "Berita resmi kampus terbaru dari news.bsi.ac.id." },
      { id: "mira_get_repository", desc: "Pencarian riset, skripsi, dan publikasi ilmiah EPrints repository.bsi.ac.id." },
    ],
  },
  {
    name: "Kategori D: Notifikasi & Sistem (4 Tools)",
    note: "Manajemen webhook pribadi, pemicu pengingat, identitas key, dan kamus API.",
    tools: [
      { id: "mira_list_channels", desc: "Daftar channel notifikasi webhook Discord atau Telegram aktif milik akun." },
      { id: "mira_trigger_reminder", desc: "Picu pengingat manual untuk kelas besok atau tugas mendesak." },
      { id: "mira_whoami", desc: "Cek identitas mahasiswa dan status Personal API Key yang sedang dipakai." },
      { id: "mira_get_api_docs", desc: "Ambil kamus lengkap endpoint REST API dan definisi MCP tools." },
    ],
  },
];

export default function DevelopersPage() {
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
            <Link href="/login" className="text-[#0369A1] hover:underline">
              Masuk ke Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#0369A1]">
          Dokumentasi Pengembang
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          REST API &amp; MCP Server Mira UBSI
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-secondary sm:text-base">
          Hubungkan bot mahasiswa, skrip pengingat, atau AI agent seperti Claude Code, Cursor,
          Codex, dan Hermes ke ekosistem akademik UBSI melalui REST API dan 42 tools MCP dalam satu
          namespace <code className="font-mono text-xs text-foreground">mira_*</code>.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0 rounded-[8px] border border-stroke bg-white p-4">
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#0369A1]">
              Base URL REST API
            </p>
            <p className="mt-1.5 break-all font-mono text-xs text-foreground">{API_BASE_URL}</p>
          </div>
          <div className="min-w-0 rounded-[8px] border border-stroke bg-white p-4">
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#0369A1]">
              Endpoint MCP (Streamable HTTP)
            </p>
            <p className="mt-1.5 break-all font-mono text-xs text-foreground">{MCP_URL}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/keys"
            className="inline-flex min-h-[42px] items-center justify-center rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white hover:text-[#072033]"
          >
            Buat Personal API Key
          </Link>
          <a
            href={API_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[42px] items-center justify-center rounded-[6px] border-[1px] border-stroke bg-white px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-[#072033]"
          >
            Buka Katalog JSON (/v1/docs)
          </a>
          <a
            href={`${GITHUB_URL}/blob/main/docs/mcp.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[42px] items-center px-1 text-xs font-medium text-[#0369A1] underline underline-offset-4 hover:text-[#075985]"
          >
            Lihat Panduan Lengkap di GitHub
          </a>
        </div>

        <div className="mt-10 space-y-10">
          <section aria-labelledby="dev-auth">
            <h2
              id="dev-auth"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              1. Autentikasi Personal API Key
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Masuk ke dashboard lewat akun MyBest di{" "}
              <Link href="/login" className="font-semibold text-[#0369A1] hover:underline">
                mira.muaraai.com/login
              </Link>
              , buka menu Personal API Keys, lalu buat key dengan prefiks{" "}
              <code className="font-mono text-xs text-foreground">muara_mira_...</code> (maksimum
              5 key aktif per akun, key lama <code className="font-mono text-xs">muara_ubsi_...</code>{" "}
              tetap didukung). Kirim key melalui header <code className="font-mono text-xs">Authorization: Bearer</code>.
            </p>
            <div className="mt-4 space-y-3">
              <div className="min-w-0 overflow-x-auto rounded-[8px] bg-[#131b26] p-4 text-xs text-[#cdd6f4]">
                <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#7DD3FC]">
                  Contoh Request REST API
                </p>
                <pre className="font-mono leading-relaxed">{CURL_EXAMPLE}</pre>
              </div>
              <div className="min-w-0 overflow-x-auto rounded-[8px] bg-[#131b26] p-4 text-xs text-[#cdd6f4]">
                <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#7DD3FC]">
                  Format Envelope Standar (200 OK)
                </p>
                <pre className="font-mono leading-relaxed">{ENVELOPE_EXAMPLE}</pre>
              </div>
            </div>
          </section>

          <section aria-labelledby="dev-mcp">
            <h2
              id="dev-mcp"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              2. Hubungkan Server MCP ke AI Agent
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Server MCP berjalan di port Streamable HTTP dan mengekspos 42 tools terisolasi per
              akun. Password kampus tetap terenkripsi di server dan tidak pernah dikirim ke model AI.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {MCP_SNIPPETS.map((snippet) => (
                <div
                  key={snippet.client}
                  className="min-w-0 rounded-[8px] border border-stroke bg-white p-4"
                >
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#0369A1]">
                    {snippet.client}
                  </p>
                  <div className="mt-2.5 min-w-0 overflow-x-auto rounded-[6px] bg-[#131b26] p-3 text-[11.5px] text-[#cdd6f4]">
                    <pre className="font-mono leading-relaxed">{snippet.code}</pre>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="dev-tools">
            <h2
              id="dev-tools"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              3. Katalog 42 Tools MCP Akademik (mira_*)
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Seluruh fungsi read dan write memakai namespace tunggal <code className="font-mono text-xs">mira_*</code>.
              Tool berlabel <code className="font-mono text-xs">[WRITE]</code> melakukan aksi tulis
              atas nama akun dan hanya boleh dipicu atas persetujuan eksplisit mahasiswa.
            </p>
            <div className="mt-5 space-y-6">
              {TOOL_GROUPS.map((group) => (
                <div
                  key={group.name}
                  className="min-w-0 overflow-hidden rounded-[8px] border border-stroke bg-white"
                >
                  <div className="border-b border-stroke bg-[#F0F7FB] px-4 py-3">
                    <h3 className="font-display text-sm font-bold text-foreground sm:text-base">
                      {group.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-secondary">{group.note}</p>
                  </div>
                  <ul className="divide-y divide-stroke">
                    {group.tools.map((tool) => (
                      <li
                        key={tool.id}
                        className="grid gap-1 px-4 py-2.5 sm:grid-cols-[240px_1fr] sm:items-baseline sm:gap-4"
                      >
                        <code className="break-all font-mono text-xs font-semibold text-[#0369A1]">
                          {tool.id}
                        </code>
                        <span className="text-xs leading-relaxed text-secondary sm:text-[13px]">
                          {tool.desc}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="dev-limits">
            <h2
              id="dev-limits"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              4. Batas Layanan, Cache &amp; Keamanan
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-secondary">
              <li>
                Rate limit API: maksimum 60 permintaan per menit per klien untuk menjaga stabilitas
                portal resmi kampus.
              </li>
              <li>
                Enkripsi berlapis: sesi aktif memakai AES-256-GCM di Redis, tautan SIAKAD memakai
                Fernet di SQLite, dan Personal API Key disimpan sebagai hash BLAKE2b.
              </li>
              <li>
                Ketahanan gangguan (SWR): saat portal kampus lambat atau sibuk, respons fallback dari
                Last-Known-Good cache menyertakan field <code className="font-mono text-xs">&quot;stale&quot;: true</code>.
              </li>
              <li>
                Aturan pemakaian: dilarang menyalahgunakan fitur tulis untuk kecurangan akademik atau
                scraping massal di luar akun milik sendiri.
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-stroke pt-6 text-xs">
          <Link href="/demo" className="font-semibold text-[#0369A1] hover:underline">
            Demo Dashboard
          </Link>
          <Link href="/login" className="font-semibold text-[#0369A1] hover:underline">
            Login Mahasiswa
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }}
      />
    </div>
  );
}
