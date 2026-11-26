import { API_BASE_URL, API_DOCS_URL, MCP_URL, SKILLS_URL } from "@/lib/public-links";

export const KEY_PLACEHOLDER = "muara_mira_YOUR_KEY";

export const SKILL_INSTALL_COMMANDS = {
  all: "npx skills add MuaraAI/Mira",
  mcpApi: "npx skills add MuaraAI/Mira --skill mira-mcp --skill mira-api",
  contributors: "npx skills add MuaraAI/Mira --skill mira-backend --skill mira-web",
} as const;

export interface MiraSkillSummary {
  id: "mira" | "mira-mcp" | "mira-api" | "mira-backend" | "mira-web";
  audience: string;
  url: string;
  desc: string;
}

export const MIRA_SKILLS: MiraSkillSummary[] = [
  {
    id: "mira",
    audience: "Router",
    url: `${SKILLS_URL}/mira`,
    desc: "Router utama untuk memilih skill Mira sesuai tugas dan peta URL layanan resmi.",
  },
  {
    id: "mira-mcp",
    audience: "AI Agent",
    url: `${SKILLS_URL}/mira-mcp`,
    desc: "Panduan 42 tools MCP mira_*, chaining token kursus eyJ..., dan gerbang persetujuan [WRITE].",
  },
  {
    id: "mira-api",
    audience: "Bot & Script",
    url: `${SKILLS_URL}/mira-api`,
    desc: "Integrasi REST API /v1/*, Personal API Key, format JSON envelope, rate limit, dan kode galat.",
  },
  {
    id: "mira-backend",
    audience: "Kontributor",
    url: `${SKILLS_URL}/mira-backend`,
    desc: "Playbook FastAPI, scraper BSI, skema ganda SQLite + Supabase, dan pytest 100% offline.",
  },
  {
    id: "mira-web",
    audience: "Kontributor",
    url: `${SKILLS_URL}/mira-web`,
    desc: "Playbook Next.js 15, Semi Pixel-Art Light, font .woff2, aksesibilitas 360px, dan standar SEO.",
  },
];

export interface IntegrationSnippet {
  id: string;
  label: string;
  hint: string;
  code: string;
}

export function buildMcpAgentPrompt(apiKey?: string | null): string {
  const key = apiKey?.trim() || KEY_PLACEHOLDER;

  return `Tolong hubungkan workspace ini ke Mira Academic MCP Server (UBSI) menggunakan detail resmi berikut.

1. Pasang Agent Skill Resmi Mira (disarankan):
Jalankan perintah berikut agar kamu memuat aturan 42 tools, token kursus, dan keamanan [WRITE]:
npx skills add MuaraAI/Mira --skill mira-mcp --skill mira-api
Katalog: ${SKILLS_URL}

2. Pasang Koneksi MCP Server:
- Nama server: mira-academic
- Transport: Streamable HTTP
- Endpoint URL: ${MCP_URL}
- Header HTTP: Authorization: Bearer ${key}

Pasang konfigurasi ke klien agent yang sedang kamu pakai:
* Claude Code CLI:
  claude mcp add --transport http mira-academic ${MCP_URL} --header "Authorization: Bearer ${key}"
* Cursor (.cursor/mcp.json):
  { "mcpServers": { "mira-academic": { "url": "${MCP_URL}", "headers": { "Authorization": "Bearer ${key}" } } } }
* Codex CLI (~/.codex/config.toml):
  [mcp_servers.mira-academic]
  url = "${MCP_URL}"
  http_headers = { "Authorization" = "Bearer ${key}" }
* Hermes Agent (~/.hermes/config.yaml):
  mcp_servers:
    mira-academic:
      url: ${MCP_URL}
      headers:
        Authorization: "Bearer ${key}"
* Claude Desktop (claude_desktop_config.json):
  Gunakan npx -y mcp-remote ${MCP_URL} --header "Authorization: Bearer ${key}"

3. Aturan Wajib 42 Tools mira_*:
- Gunakan namespace tunggal mira_* (alias lama ubsi_* sudah dihapus).
- Untuk fitur MyBest (tugas, presensi, materi, diskusi), panggil mira_get_courses terlebih dahulu untuk memperoleh token terenkripsi Laravel (eyJ...).
- 12 tool SIAKAD bersifat opsional. Jika muncul error SIAKAD_RELINK_REQUIRED, arahkan saya menautkan ulang SIAKAD di https://mira.muaraai.com/dashboard/sesi.
- Gerbang Keamanan [WRITE]: Jangan pernah memanggil mira_submit_presence, mira_submit_assignment, mira_upload_assignment, mira_submit_quiz_answer, mira_submit_discussion_comment, mira_create_discussion, atau mira_submit_teaching_feedback tanpa persetujuan eksplisit saya di chat berjalan.
- Jangan menulis atau meng-commit API Key ke file repository git maupun log publik.

4. Verifikasi Koneksi:
Setelah terpasang, panggil mira_whoami untuk memastikan API Key aktif, lalu rangkum jadwal kuliah dan tugas aktif saya hari ini.`;
}

export function buildRestAgentPrompt(apiKey?: string | null): string {
  const key = apiKey?.trim() || KEY_PLACEHOLDER;

  return `Tolong bantu saya membangun skrip atau bot menggunakan Mira REST API (UBSI API) sesuai spesifikasi resmi berikut.

1. Pasang Agent Skill REST API Mira (disarankan):
npx skills add MuaraAI/Mira --skill mira-api
Katalog: ${SKILLS_URL}

2. Spesifikasi Teknis API:
- Base URL Gateway: ${API_BASE_URL}
- Katalog Endpoint JSON: ${API_DOCS_URL}
- Dokumentasi Web: https://mira.muaraai.com/developers
- Autentikasi: kirim header Authorization: Bearer ${key} pada setiap request privat.
- Simpan key di environment variable (.env) sebagai MIRA_API_KEY, jangan pernah hardcode atau commit ke git.
- Format JSON Envelope:
  * Sukses (200): { "success": true, "data": ..., "cached": false } (berisi "stale": true saat melayani cache SWR ketika server kampus sibuk).
  * Error (4xx/5xx): { "success": false, "error": { "code": "...", "message": "...", "module": "..." } }.

3. Aturan Keamanan & Batas Laju:
- Batas laju standar: 60 permintaan/menit per klien. Jika mendapat 429 RATE_LIMITED, tunggu sesuai header Retry-After.
- Tangani error spesifik: 401 UNAUTHORIZED (key salah/dicabut), 409 SIAKAD_RELINK_REQUIRED (tautan SIAKAD perlu diperbarui di /dashboard/sesi), 502 UPSTREAM_ERROR (exponential backoff), dan 503 MAINTENANCE.
- Jangan menjadwalkan endpoint mutasi (presensi, submit tugas, jawab kuis) di cron tanpa persetujuan eksplisit pengguna.

4. Mulai Integrasi:
Baca katalog endpoint dari /v1/docs atau skill mira-api, uji koneksi GET /v1/elearning/schedule (atau GET /v1/auth/me), lalu bantu saya membuat integrasi berikut:`;
}

export function buildMcpSnippets(apiKey?: string | null): IntegrationSnippet[] {
  const key = apiKey?.trim() || KEY_PLACEHOLDER;

  return [
    {
      id: "claude-code",
      label: "Claude Code CLI",
      hint: "Jalankan sekali di terminal, lalu mulai sesi Claude Code baru.",
      code: `claude mcp add --transport http mira-academic \\\n  ${MCP_URL} \\\n  --header "Authorization: Bearer ${key}"`,
    },
    {
      id: "cursor",
      label: "Cursor IDE (.cursor/mcp.json)",
      hint: "Simpan sebagai .cursor/mcp.json di root project kamu.",
      code: JSON.stringify(
        {
          mcpServers: {
            "mira-academic": {
              url: MCP_URL,
              headers: { Authorization: `Bearer ${key}` },
            },
          },
        },
        null,
        2
      ),
    },
    {
      id: "codex",
      label: "Codex CLI (~/.codex/config.toml)",
      hint: "Tambahkan ke berkas ~/.codex/config.toml.",
      code: `[mcp_servers.mira-academic]\nurl = "${MCP_URL}"\nhttp_headers = { "Authorization" = "Bearer ${key}" }`,
    },
    {
      id: "hermes",
      label: "Hermes Agent (~/.hermes/config.yaml)",
      hint: "Tambahkan ke blok mcp_servers di ~/.hermes/config.yaml.",
      code: `mcp_servers:\n  mira-academic:\n    url: ${MCP_URL}\n    headers:\n      Authorization: "Bearer ${key}"`,
    },
    {
      id: "claude-desktop",
      label: "Claude Desktop (claude_desktop_config.json)",
      hint: "Pakai mcp-remote karena Claude Desktop lokal menggunakan stdio bridge.",
      code: JSON.stringify(
        {
          mcpServers: {
            "mira-academic": {
              command: "npx",
              args: [
                "-y",
                "mcp-remote",
                MCP_URL,
                "--header",
                `Authorization: Bearer ${key}`,
              ],
            },
          },
        },
        null,
        2
      ),
    },
  ];
}

export function buildRestSnippets(apiKey?: string | null): IntegrationSnippet[] {
  const key = apiKey?.trim() || KEY_PLACEHOLDER;
  const scheduleUrl = `${API_BASE_URL}/v1/elearning/schedule`;

  return [
    {
      id: "curl",
      label: "cURL",
      hint: "Uji langsung dari terminal untuk mengambil jadwal kuliah aktif.",
      code: `curl -s "${scheduleUrl}" \\\n  -H "Authorization: Bearer ${key}"`,
    },
    {
      id: "python",
      label: "Python (requests)",
      hint: "Cocok untuk skrip pengingat harian, bot Telegram, atau Discord.",
      code: `# Simpan di .env: MIRA_API_KEY=${key}\nimport os\nimport requests\n\napi_key = os.environ["MIRA_API_KEY"]\nres = requests.get(\n    "${scheduleUrl}",\n    headers={"Authorization": f"Bearer {api_key}"},\n    timeout=20,\n)\npayload = res.json()\nprint(payload["data"])`,
    },
    {
      id: "javascript",
      label: "JavaScript / Node.js (fetch)",
      hint: "Bisa dijalankan di Node 18+, Bun, Deno, atau serverless worker.",
      code: `// Simpan di .env: MIRA_API_KEY=${key}\nconst res = await fetch("${scheduleUrl}", {\n  headers: {\n    Authorization: \`Bearer \${process.env.MIRA_API_KEY}\`,\n  },\n});\nconst payload = await res.json();\nconsole.log(payload.data);`,
    },
  ];
}
