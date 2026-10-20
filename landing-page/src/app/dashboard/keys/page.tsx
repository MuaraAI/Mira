"use client";

import { useState, useEffect } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  ShieldCheck,
  Code2,
  X,
  Clock,
  Blocks,
  Sparkles,
} from "lucide-react";
import { apiFetch, ApiError, useApi, clearApiCache } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
} from "@/components/dashboard-ui";

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

const MCP_URL = "https://api.muaraai.com/v1/ubsi-api/mcp";

const MCP_SNIPPETS: { id: string; label: string; hint: string; code: string }[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    hint: "Jalankan sekali di terminal, lalu restart sesi Claude Code.",
    code: `claude mcp add --transport http ubsi-academic \\\n  ${MCP_URL} \\\n  --header "Authorization: Bearer muara_ubsi_YOUR_KEY"`,
  },
  {
    id: "cursor",
    label: "Cursor",
    hint: "Simpan sebagai .cursor/mcp.json di root project Anda.",
    code: JSON.stringify(
      {
        mcpServers: {
          "ubsi-academic": {
            url: MCP_URL,
            headers: { Authorization: "Bearer muara_ubsi_YOUR_KEY" },
          },
        },
      },
      null,
      2
    ),
  },
  {
    id: "codex",
    label: "Codex CLI",
    hint: "Tambahkan ke ~/.codex/config.toml.",
    code: `[mcp_servers.ubsi-academic]\nurl = "${MCP_URL}"\nhttp_headers = { "Authorization" = "Bearer muara_ubsi_YOUR_KEY" }`,
  },
  {
    id: "hermes",
    label: "Hermes Agent",
    hint: "Tambahkan ke blok mcp_servers di ~/.hermes/config.yaml.",
    code: `mcp_servers:\n  ubsi-academic:\n    url: ${MCP_URL}\n    headers:\n      Authorization: "Bearer muara_ubsi_YOUR_KEY"`,
  },
];

const MCP_AGENT_PROMPT = `Server MCP UBSI: https://api.muaraai.com/v1/ubsi-api/mcp
API Base URL: https://api.muaraai.com/v1/ubsi-api

Kamu adalah asisten akademik pribadi mahasiswa UBSI yang terhubung ke server MCP di atas.
Gunakan tools MCP "ubsi-*" yang tersedia (jadwal kuliah, nilai & KHS, KRS, kartu ujian,
tugas perkuliahan, presensi kehadiran, bahan ajar 5 kategori berkas, berita resmi, perpustakaan OPAC)
untuk menjawab kebutuhan akademik saya dengan data real-time langsung dari akun saya sendiri.
Contoh: "Jadwal besok apa?", "Cek tugas yang belum dikumpul", "Berapa IPK gw?", "Cari buku algoritma".`;

export default function ApiKeysPage() {
  const { data, loading, error, reload } = useApi<{ keys: ApiKeyItem[]; total: number }>(
    "/v1/auth/keys"
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [docsTab, setDocsTab] = useState<"rest" | "mcp">("rest");
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

  const keys = data?.keys ?? [];
  const atLimit = keys.length >= MAX_KEYS;

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
    if (!window.confirm("Cabut (revoke) API Key ini? Script/bot yang menggunakan key ini tidak akan dapat mengakses API lagi.")) {
      return;
    }

    setRevokingId(id);
    try {
      await apiFetch(`/v1/auth/keys/${id}`, { method: "DELETE" });
      clearApiCache("/v1/auth/keys");
      reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal mencabut API Key.");
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Personal API Key"
          description="Gunakan API Key pribadi (muara_ubsi_***) untuk mengotomasi bot Discord, Telegram, atau skrip tanpa menyimpan password kampus."
        />

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-pill bg-[#F0F7FB] border border-[#D9E5ED] text-xs font-mono">
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
            description="Buat API Key untuk mengakses jadwal, nilai, dan modul lewat skrip mandiri secara aman."
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
            <table className="w-full text-left text-xs border-collapse">
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
                    <td className="py-3 px-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 text-[#0369A1]" />
                        <span>{k.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#0369A1]">
                      <span className="px-2 py-0.5 rounded bg-[#F0F7FB] border border-[#D9E5ED]">
                        {k.prefix}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-secondary font-mono">
                      {new Date(k.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 text-secondary font-mono">
                      {k.last_used_at ? (
                        new Date(k.last_used_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      ) : (
                        <span className="text-secondary/60">Belum pernah</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
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

      {/* DOKUMENTASI: REST API & MCP SERVER */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Code2 className="h-4 w-4 text-[#0369A1]" />
            <span>Cara Menghubungkan Akun Anda</span>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#F0F7FB] border border-stroke rounded-pill self-start">
            <button
              type="button"
              onClick={() => setDocsTab("rest")}
              aria-pressed={docsTab === "rest"}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-pill transition-all inline-flex items-center gap-1.5 ${
                docsTab === "rest"
                  ? "bg-[#0369A1] text-white shadow-sm"
                  : "text-secondary hover:text-foreground"
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              REST API
            </button>
            <button
              type="button"
              onClick={() => setDocsTab("mcp")}
              aria-pressed={docsTab === "mcp"}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-pill transition-all inline-flex items-center gap-1.5 ${
                docsTab === "mcp"
                  ? "bg-[#0369A1] text-white shadow-sm"
                  : "text-secondary hover:text-foreground"
              }`}
            >
              <Blocks className="h-3.5 w-3.5" aria-hidden="true" />
              MCP Server
            </button>
          </div>
        </div>

        {docsTab === "rest" ? (
          <>
            <p className="text-xs text-secondary leading-relaxed">
              Sertakan kunci di header{" "}
              <code className="text-[#0369A1] font-mono">Authorization: Bearer muara_...</code> atau{" "}
              <code className="text-[#0369A1] font-mono">X-API-Key: muara_...</code> pada setiap pemanggilan HTTP.
            </p>

            <div className="bg-[#131B26] p-4 rounded-xl border border-white/10 font-mono text-xs text-code-text overflow-x-auto space-y-3">
              <div>
                <p className="text-code-text/60 text-[11px] mb-1"># 1. Ambil Jadwal Kuliah Anda lewat cURL:</p>
                <pre className="text-[#7DD3FC]">
                  {`curl -H "Authorization: Bearer muara_ubsi_YOUR_KEY" \\
  https://api.muaraai.com/v1/ubsi-api/v1/studentv2/schedule`}
                </pre>
              </div>
              <div className="pt-2 border-t border-white/10">
                <p className="text-code-text/60 text-[11px] mb-1"># 2. Skrip Python Otomasi:</p>
                <pre className="text-code-text/90">
{`import requests

headers = {"Authorization": "Bearer muara_ubsi_YOUR_KEY"}
res = requests.get("https://api.muaraai.com/v1/ubsi-api/v1/studentv2/schedule", headers=headers)
print(res.json())`}
                </pre>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-secondary leading-relaxed">
              Personal API Key yang sama bisa dipakai untuk menyambungkan akademik UBSI Anda ke{" "}
              <strong className="text-foreground">AI Agent</strong> (Claude Code, Cursor, Codex, Hermes) lewat{" "}
              <strong className="text-foreground">MCP (Model Context Protocol)</strong>. Satu koneksi, 38 tools akademik:
              jadwal, nilai &amp; KHS, KRS, kuis online, tugas &amp; link submit, presensi DataTables, bahan ajar, forum diskusi, kalender, berita, perpustakaan, dan kamus dokumentasi API
              langsung dari chat agent Anda.
            </p>

            {/* Prompt Siap Pakai di ATAS agar terlihat langsung (hero spot) */}
            <div className="rounded-xl border border-[#0369A1]/30 bg-gradient-to-br from-[#F0F7FB] to-white p-5 space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#0369A1]/15 pb-2.5">
                <div>
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                    Prompt Siap Pakai untuk Agent
                  </p>
                  <p className="text-[11px] text-secondary mt-0.5">
                    Tempel prompt ini sebagai pesan pertama agar agent langsung paham base URL dan tools akademik Anda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyBlock(MCP_AGENT_PROMPT, "agent-prompt")}
                  className={`${primaryButtonClass} text-xs py-1.5 px-3 shrink-0 self-start sm:self-auto`}
                  aria-label="Salin prompt untuk agent"
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
              <div className="bg-[#131B26] p-3.5 rounded-lg border border-white/10 font-mono text-[11px] leading-relaxed text-[#7DD3FC] overflow-x-auto whitespace-pre-wrap">
                {MCP_AGENT_PROMPT}
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
                {MCP_SNIPPETS.map((s) => (
                  <div key={s.id} className="rounded-xl border border-stroke overflow-hidden bg-[#131B26]">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                      <div>
                        <p className="text-xs font-bold text-code-text font-sans flex items-center gap-1.5">
                          <Blocks className="h-3.5 w-3.5 text-[#7DD3FC]" aria-hidden="true" />
                          {s.label}
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
              Ganti <code className="font-mono text-[#0369A1]">muara_ubsi_YOUR_KEY</code> dengan Personal API Key Anda di atas.
              Kunci dikirim sebagai header HTTP saat agent memanggil tools, aman dan tidak disimpan server.
            </p>
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
                  Tersisa {MAX_KEYS - keys.length} slot API Key untuk akun Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setCreatedKey(null);
                }}
                className="p-1 rounded-lg text-secondary hover:text-foreground hover:bg-white/10 transition-colors"
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
                    Personal API Key Anda:
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
                    {saving ? "Membuat Kunci..." : "Generate Key"}
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