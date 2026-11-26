"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Code2,
  X,
  Blocks,
  Sparkles,
  Terminal,
  ExternalLink,
} from "lucide-react";
import { apiFetch, ApiError, useApi, clearApiCache } from "@/lib/api";
import { API_DOCS_URL, MCP_URL, SKILLS_URL } from "@/lib/public-links";
import {
  KEY_PLACEHOLDER,
  MIRA_SKILLS,
  SKILL_INSTALL_COMMANDS,
  buildMcpAgentPrompt,
  buildMcpSnippets,
  buildRestAgentPrompt,
  buildRestSnippets,
} from "@/lib/developer-prompts";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
} from "@/components/dashboard-ui";
import { useDialog } from "@/components/ConfirmDialog";

interface ApiKeyItem {
  id: number;
  nim: string;
  name: string;
  prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

const MAX_KEYS = 5;

export default function ApiKeysPage() {
  const { confirm, notify } = useDialog();
  const { data, loading, error, reload } = useApi<{ keys: ApiKeyItem[]; total: number }>(
    "/v1/auth/keys"
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [docsTab, setDocsTab] = useState<"rest" | "mcp" | "skills">("rest");
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  // Close modal on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsModalOpen(false);
        setCreatedKey(null);
      }
    }
    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isModalOpen]);

  if (loading) return <LoadingState label="Memuat Personal API Key" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const keys = data?.keys || [];
  const atLimit = keys.length >= MAX_KEYS;

  const mcpPrompt = buildMcpAgentPrompt(createdKey);
  const restPrompt = buildRestAgentPrompt(createdKey);
  const mcpSnippets = buildMcpSnippets(createdKey);
  const restSnippets = buildRestSnippets(createdKey);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError("Nama atau label API Key wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch<{ id: number; key: string; name: string }>(
        "/v1/auth/keys",
        { json: { name: name.trim() } }
      );
      setCreatedKey(res.key);
      clearApiCache("/v1/auth/keys");
      setName("");
      reload();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Gagal membuat API Key. Coba lagi."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: number) {
    const ok = await confirm({
      title: "Cabut API Key ini?",
      message: "Script atau bot yang memakai key ini langsung kehilangan akses ke API. Tindakan ini tidak bisa dibatalkan.",
      confirmLabel: "Cabut key",
      tone: "danger",
    });
    if (!ok) return;

    setRevokingId(id);
    try {
      await apiFetch(`/v1/auth/keys/${id}`, { method: "DELETE" });
      clearApiCache("/v1/auth/keys");
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Gagal mencabut API Key.");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopy() {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  async function handleCopyBlock(text: string, blockId: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBlock(blockId);
      setTimeout(() => setCopiedBlock(null), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col">
        <PageHeader
          title="Personal API Key"
          description="Pakai API Key pribadi buat bot Discord, Telegram, atau skrip sendiri tanpa menyimpan password kampus."
        />

        <div className="flex items-center gap-3">
          <div className="px-chip whitespace-nowrap px-3 py-2 bg-[#F0F7FB] text-xs font-mono [--px-line:#CFE2EE]">
            <span className="text-secondary">Slot: </span>
            <span className={atLimit ? "text-amber-800 font-bold" : "text-[#0369A1] font-bold"}>
              {keys.length} / {MAX_KEYS}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setCreatedKey(null);
              setIsModalOpen(true);
            }}
            disabled={atLimit}
            className={`${primaryButtonClass} text-xs py-2 px-3.5`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Buat API Key
          </button>
        </div>
      </div>

      {keys.length === 0 ? (
        <div className="glass-card p-8 text-center space-y-4">
          <EmptyState
            title="Belum ada API Key aktif."
            description="Buat API Key buat akses jadwal, nilai, dan data lain lewat skrip."
          />
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setCreatedKey(null);
              setIsModalOpen(true);
            }}
            className={`${primaryButtonClass} mx-auto`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Buat API Key Pertama
          </button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="px-table w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 font-mono text-secondary">
                  <th scope="col" className="py-3 px-4">NAMA / LABEL</th>
                  <th scope="col" className="py-3 px-4">KEY PREVIEW</th>
                  <th scope="col" className="py-3 px-4">DIBUAT</th>
                  <th scope="col" className="py-3 px-4">TERAKHIR PAKAI</th>
                  <th scope="col" className="py-3 px-4 text-right">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-white/5 transition-colors">
                    <td data-label="NAMA / LABEL" data-primary="" className="py-3 px-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 text-[#0369A1]" />
                        <span>{k.name}</span>
                      </div>
                    </td>
                    <td data-label="KEY PREVIEW" className="py-3 px-4 font-mono text-[#0369A1]">
                      <span className="px-2 py-0.5 rounded bg-[#F0F7FB] border border-[#D9E5ED]">
                        {k.prefix}
                      </span>
                    </td>
                    <td data-label="DIBUAT" className="py-3 px-4 text-secondary font-mono">
                      {new Date(k.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td data-label="TERAKHIR PAKAI" className="py-3 px-4 text-secondary font-mono">
                      {k.last_used_at ? (
                        new Date(k.last_used_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      ) : (
                        <span className="text-secondary">Belum pernah</span>
                      )}
                    </td>
                    <td data-label="AKSI" className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleRevoke(k.id)}
                        disabled={revokingId === k.id}
                        className={`${ghostButtonClass} text-xs py-1 px-2.5 text-[#BE123C] hover:border-[#BE123C]/40 hover:bg-rose-500/10`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DOKUMENTASI: REST API, MCP SERVER & AGENT SKILLS */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Code2 className="h-4 w-4 text-[#0369A1]" />
            <span>Cara Menghubungkan Akun kamu</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F0F7FB] border border-stroke rounded-pill self-start">
            <button
              type="button"
              onClick={() => setDocsTab("rest")}
              aria-pressed={docsTab === "rest"}
              className={`px-seg-btn inline-flex items-center gap-1.5 ${
                docsTab === "rest" ? "px-seg-on" : ""
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              REST API
            </button>
            <button
              type="button"
              onClick={() => setDocsTab("mcp")}
              aria-pressed={docsTab === "mcp"}
              className={`px-seg-btn inline-flex items-center gap-1.5 ${
                docsTab === "mcp" ? "px-seg-on" : ""
              }`}
            >
              <Blocks className="h-3.5 w-3.5" aria-hidden="true" />
              MCP Server
            </button>
            <button
              type="button"
              onClick={() => setDocsTab("skills")}
              aria-pressed={docsTab === "skills"}
              className={`px-seg-btn inline-flex items-center gap-1.5 ${
                docsTab === "skills" ? "px-seg-on" : ""
              }`}
            >
              <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
              Agent Skills
            </button>
          </div>
        </div>

        {docsTab === "rest" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary leading-relaxed">
              <p>
                Sertakan kunci di header{" "}
                <code className="text-[#0369A1] font-mono">Authorization: Bearer muara_...</code> atau{" "}
                <code className="text-[#0369A1] font-mono">X-API-Key: muara_...</code> pada setiap pemanggilan HTTP.
              </p>
              <div className="flex flex-wrap items-center gap-3 font-medium">
                <Link href="/developers" className="text-[#0369A1] underline underline-offset-4 hover:text-[#072033]">
                  Dokumentasi Lengkap
                </Link>
                <a
                  href={API_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#0369A1] underline underline-offset-4 hover:text-[#072033]"
                >
                  <span>Katalog JSON (/v1/docs)</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-[#0369A1]/30 bg-gradient-to-br from-[#F0F7FB] to-white p-5 space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#0369A1]/15 pb-2.5">
                <div>
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                    Prompt Siap Pakai untuk Bot / REST API
                  </p>
                  <p className="text-[11px] text-secondary mt-0.5">
                    Tempel ke agent atau LLM saat ingin membangun bot Discord, Telegram, atau skrip otomasi lewat Mira REST API.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyBlock(restPrompt, "rest-prompt")}
                  className={`${primaryButtonClass} text-xs py-1.5 px-3 shrink-0 self-start sm:self-auto`}
                  aria-label="Salin prompt REST API untuk agent"
                >
                  {copiedBlock === "rest-prompt" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Salin Prompt</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-[#131B26] p-3.5 rounded-lg border border-white/10 font-mono text-[11px] leading-relaxed text-[#E2F1FC] overflow-x-auto whitespace-pre-wrap break-words">
                {restPrompt}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {restSnippets.map((s) => (
                <div key={s.id} className="min-w-0 rounded-xl border border-stroke overflow-hidden bg-[#131B26]">
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/10">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-code-text font-sans">{s.label}</p>
                      <p className="text-[10px] text-code-text/60 mt-0.5 font-sans">{s.hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBlock(s.code, `rest-${s.id}`)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill border border-white/20 text-[11px] font-semibold text-code-text hover:bg-white/10 transition-colors shrink-0"
                      aria-label={`Salin contoh ${s.label}`}
                    >
                      {copiedBlock === `rest-${s.id}` ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" aria-hidden="true" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="px-4 py-3 font-mono text-[11px] leading-relaxed text-[#7DD3FC] overflow-x-auto">
                    {s.code}
                  </pre>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-secondary leading-relaxed">
              Ingin agent coding otomatis memahami seluruh endpoint &amp; error code Mira? Buka tab{" "}
              <button
                type="button"
                onClick={() => setDocsTab("skills")}
                className="font-semibold text-[#0369A1] underline underline-offset-4 hover:text-[#072033]"
              >
                Agent Skills
              </button>{" "}
              atau jalankan <code className="font-mono text-[#0369A1]">{SKILL_INSTALL_COMMANDS.mcpApi}</code>.
            </p>
          </>
        ) : docsTab === "mcp" ? (
          <>
            <p className="text-xs text-secondary leading-relaxed">
              Personal API Key yang sama bisa dipakai untuk menyambungkan akademik UBSI kamu ke{" "}
              <strong className="text-foreground">AI Agent</strong> (Claude Code, Cursor, Codex, Hermes, Claude Desktop) lewat{" "}
              <strong className="text-foreground">MCP (Model Context Protocol)</strong>. Satu koneksi, 42 tools akademik:
              jadwal, nilai &amp; KHS, KRS, kuis &amp; ujian online, tugas &amp; link submit, presensi DataTables, bahan ajar, forum diskusi, kalender, berita, perpustakaan, dan kamus dokumentasi API
              langsung dari chat agent kamu.
            </p>

            {/* Prompt Siap Pakai di ATAS agar terlihat langsung (hero spot) */}
            <div className="rounded-xl border border-[#0369A1]/30 bg-gradient-to-br from-[#F0F7FB] to-white p-5 space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#0369A1]/15 pb-2.5">
                <div>
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                    Prompt Siap Pakai untuk Agent (MCP + Skill)
                  </p>
                  <p className="text-[11px] text-secondary mt-0.5">
                    Tempel prompt ini sebagai pesan pertama agar agent otomatis memasang skill mira-mcp, endpoint Streamable HTTP, dan aturan konfirmasi [WRITE].
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyBlock(mcpPrompt, "agent-prompt")}
                  className={`${primaryButtonClass} text-xs py-1.5 px-3 shrink-0 self-start sm:self-auto`}
                  aria-label="Salin prompt MCP untuk agent"
                >
                  {copiedBlock === "agent-prompt" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Salin Prompt</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-[#131B26] p-3.5 rounded-lg border border-white/10 font-mono text-[11px] leading-relaxed text-[#E2F1FC] overflow-x-auto whitespace-pre-wrap break-words">
                {mcpPrompt}
              </div>
            </div>

            {/* Server URL */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-foreground shrink-0">Server URL (Streamable HTTP):</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <code className="flex-1 min-w-0 truncate font-mono text-[11px] px-3 py-1.5 rounded-sm bg-[#131B26] text-[#7DD3FC] border border-white/10">
                  {MCP_URL}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopyBlock(MCP_URL, "mcp-url")}
                  className={`${ghostButtonClass} text-xs py-1.5 px-2.5 shrink-0`}
                  aria-label="Salin URL server MCP"
                >
                  {copiedBlock === "mcp-url" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Per-agent config snippets */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground">Konfigurasi Per Agent Client</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {mcpSnippets.map((s) => (
                  <div key={s.id} className="min-w-0 rounded-xl border border-stroke overflow-hidden bg-[#131B26]">
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/10">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-code-text font-sans flex items-center gap-1.5">
                          <Blocks className="h-3.5 w-3.5 text-[#7DD3FC] shrink-0" aria-hidden="true" />
                          <span className="truncate">{s.label}</span>
                        </p>
                        <p className="text-[10px] text-code-text/60 mt-0.5 font-sans">{s.hint}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyBlock(s.code, s.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill border border-white/20 text-[11px] font-semibold text-code-text hover:bg-white/10 transition-colors shrink-0"
                        aria-label={`Salin konfigurasi ${s.label}`}
                      >
                        {copiedBlock === s.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" aria-hidden="true" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="px-4 py-3 font-mono text-[11px] leading-relaxed text-[#7DD3FC] overflow-x-auto">
                      {s.code}
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-secondary leading-relaxed">
              Ganti <code className="font-mono text-[#0369A1]">{KEY_PLACEHOLDER}</code> dengan Personal API Key kamu di atas.
              Kunci dikirim sebagai header HTTP saat agent memanggil tools, aman dan tidak disimpan server.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-secondary leading-relaxed">
              <p>
                Pasang <strong className="text-foreground">Mira Agent Skills</strong> agar AI Coding Agent
                (Claude Code, Cursor, Codex, Gemini CLI, Hermes, Antigravity) langsung menguasai alur 42 tools MCP,
                keamanan <code className="font-mono text-[#0369A1]">[WRITE]</code>, REST API, dan playbook kontributor.
              </p>
              <a
                href={SKILLS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#0369A1] underline underline-offset-4 hover:text-[#072033] shrink-0"
              >
                <span>Buka di skills.sh</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: "skill-all",
                  label: "Pasang Seluruh 5 Skill Mira",
                  hint: "Direkomendasikan jika agent dipakai untuk MCP, REST API, sekaligus kontribusi kode.",
                  code: SKILL_INSTALL_COMMANDS.all,
                },
                {
                  id: "skill-mcp-api",
                  label: "Khusus Pengguna MCP & REST API",
                  hint: "Untuk mengintegrasikan jadwal, tugas, presensi, atau membuat bot mahasiswa.",
                  code: SKILL_INSTALL_COMMANDS.mcpApi,
                },
                {
                  id: "skill-contrib",
                  label: "Khusus Kontributor Kode (Muara AI / UBSI)",
                  hint: "Aturan branch PR, FastAPI offline TDD, dual-DB SQLite + Supabase, Next.js 15, & SEO.",
                  code: SKILL_INSTALL_COMMANDS.contributors,
                },
              ].map((item) => (
                <div key={item.id} className="min-w-0 rounded-xl border border-stroke overflow-hidden bg-[#131B26]">
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/10">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-code-text font-sans">{item.label}</p>
                      <p className="text-[10px] text-code-text/60 mt-0.5 font-sans">{item.hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBlock(item.code, item.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill border border-white/20 text-[11px] font-semibold text-code-text hover:bg-white/10 transition-colors shrink-0"
                      aria-label={`Salin perintah ${item.label}`}
                    >
                      {copiedBlock === item.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" aria-hidden="true" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="px-4 py-3 font-mono text-[11.5px] leading-relaxed text-[#7DD3FC] overflow-x-auto">
                    {item.code}
                  </pre>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-stroke bg-white overflow-hidden">
              <ul className="divide-y divide-stroke">
                {MIRA_SKILLS.map((skill) => (
                  <li
                    key={skill.id}
                    className="grid gap-1.5 px-4 py-3 sm:grid-cols-[200px_1fr] sm:items-baseline sm:gap-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={skill.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs font-semibold text-[#0369A1] underline underline-offset-4 hover:text-[#072033]"
                      >
                        {skill.id}
                      </a>
                      <span className="rounded px-1.5 py-0.5 bg-[#F0F7FB] border border-[#CFE2EE] font-mono text-[10px] font-medium text-[#072033]">
                        {skill.audience}
                      </span>
                    </div>
                    <span className="text-xs text-secondary leading-relaxed">{skill.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* POPUP MODAL CREATE KEY */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="glass-card-3d w-full max-w-lg p-6 sm:p-7 relative rounded-2xl shadow-2xl border border-[#0369A1]/30 space-y-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="key-modal-title"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 id="key-modal-title" className="text-lg font-display font-bold text-foreground">
                  {createdKey ? "API Key Berhasil Dibuat" : "Buat Personal API Key"}
                </h2>
                <p className="text-xs text-secondary mt-0.5">
                  Tersisa {MAX_KEYS - keys.length} slot API Key untuk akun kamu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setCreatedKey(null);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-secondary hover:text-foreground hover:bg-black/5 transition-colors"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createdKey ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>PENTING:</strong> Kunci ini <u>hanya ditampilkan satu kali</u>. Salin dan simpan di tempat aman (seperti file .env atau password manager) sekarang juga.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Personal API Key kamu:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdKey}
                      className={`${inputClass} font-mono text-xs select-all text-[#7DD3FC] bg-[#131B26]`}
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`${primaryButtonClass} shrink-0 py-2.5 px-3.5 text-xs`}
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setCreatedKey(null);
                    }}
                    className={primaryButtonClass}
                  >
                    Saya Sudah Menyimpannya
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                {formError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="key-name" className="block text-xs font-semibold text-foreground mb-1.5">
                    Nama / Label Penggunaan Key
                  </label>
                  <input
                    id="key-name"
                    type="text"
                    required
                    maxLength={50}
                    placeholder="Contoh: Bot Discord Jadwal, Cron Script Python"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-secondary">
                    Gunakan nama deskriptif agar mudah dikenali di kemudian hari.
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={ghostButtonClass}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving || atLimit}
                    className={primaryButtonClass}
                  >
                    {saving ? "Membuat Kunci..." : "Buat API Key"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}