"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Eye, FileText, FolderOpen, Github, Link2, Loader2, RefreshCw, X } from "lucide-react";
import { parseShareLink, type LinkCheck } from "@/lib/links";

const PREVIEW_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

function ProviderIcon({ provider, label }: { provider: string; label: string }) {
  const cls = "h-5 w-5";
  if (provider === "github") return <Github className={cls} aria-hidden="true" />;
  if (/folder/i.test(label)) return <FolderOpen className={cls} aria-hidden="true" />;
  if (provider === "google_drive" || provider === "google_docs") return <FileText className={cls} aria-hidden="true" />;
  return <Link2 className={cls} aria-hidden="true" />;
}

function shortId(id: string | null) {
  if (!id) return "";
  return id.length > 16 ? `${id.slice(0, 6)}…${id.slice(-6)}` : id;
}

function StatusPill({ access, checking }: { access: LinkCheck["access"] | null; checking: boolean }) {
  if (access === null && !checking) {
    return <span className="inline-flex shrink-0 items-center bg-[#F0F7FB] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-secondary">Belum dicek</span>;
  }
  if (checking || access === null) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 bg-[#F0F7FB] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-secondary">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Mengecek
      </span>
    );
  }
  const map: Record<LinkCheck["access"], { text: string; cls: string }> = {
    public: { text: "Publik", cls: "bg-[#0F766E] text-white" },
    private: { text: "Belum publik", cls: "bg-[#BE123C] text-white" },
    missing: { text: "Tidak ada", cls: "bg-[#BE123C] text-white" },
    invalid: { text: "Tidak valid", cls: "bg-[#BE123C] text-white" },
    unknown: { text: "Tak terdeteksi", cls: "bg-[#F0F7FB] text-secondary" },
  };
  const { text, cls } = map[access];
  return <span className={`inline-flex shrink-0 items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${cls}`}>{text}</span>;
}

/** Peringatan merah saat link tidak bisa dibuka orang lain, lengkap dengan langkah memperbaikinya. */
export function LinkAccessWarning({ check, provider }: { check: LinkCheck | null; provider: string | null }) {
  if (!check || (check.access !== "private" && check.access !== "missing")) return null;
  const google = provider === "google_drive" || provider === "google_docs";
  return (
    <div className="bg-[#FFF1F2] p-3 text-xs leading-relaxed text-[#9F1239] shadow-[0_-2px_0_0_#FDA4AF,0_2px_0_0_#FDA4AF,-2px_0_0_0_#FDA4AF,2px_0_0_0_#FDA4AF]" role="alert">
      <p className="flex items-center gap-1.5 font-bold">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {check.access === "missing" ? "Link tidak ditemukan" : "Dosen belum bisa membuka link ini"}
      </p>
      <p className="mt-1">{check.message}</p>
      {google && check.access === "private" && (
        <ol className="mt-2 list-decimal space-y-0.5 pl-5">
          <li>Buka berkasnya di Google Drive, klik <strong>Bagikan</strong>.</li>
          <li>Di bagian Akses umum pilih <strong>Siapa saja yang memiliki link</strong>.</li>
          <li>Pastikan perannya <strong>Pelihat (Viewer)</strong>, lalu klik <strong>Selesai</strong> dan tekan Cek ulang.</li>
        </ol>
      )}
    </div>
  );
}

function PreviewDialog({ check, onClose }: { check: LinkCheck; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  let src: string | null = null;
  try {
    const target = new URL(check.preview_url ?? "");
    if (target.protocol === "https:" && PREVIEW_HOSTS.has(target.hostname)) src = target.toString();
  } catch {
    src = null;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="modal-backdrop fixed inset-0 bg-[#072033]/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pratinjau berkas"
        className="sheet-panel relative z-10 flex h-[85dvh] w-full max-w-4xl flex-col bg-white shadow-[0_-4px_0_0_#0369A1] sm:shadow-[0_-2px_0_0_#163A55,0_2px_0_0_#163A55,-2px_0_0_0_#163A55,2px_0_0_0_#163A55,8px_8px_0_0_#0369A1]"
      >
        <div className="flex items-center gap-3 border-b-2 border-px-soft bg-px-tint p-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#0369A1]">Pratinjau</p>
            <p className="truncate text-sm font-bold text-foreground">{check.title || check.label}</p>
          </div>
          {check.normalized_url && (
            <a href={check.normalized_url} target="_blank" rel="noopener noreferrer" className="px-btn-ghost inline-flex min-h-10 items-center gap-1.5 px-3 text-xs font-bold">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Buka</span>
            </a>
          )}
          <button type="button" onClick={onClose} aria-label="Tutup pratinjau" className="px-frame flex min-h-10 min-w-10 items-center justify-center bg-white text-secondary [--px-line:#CFE2EE] hover:text-foreground">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="relative min-h-0 flex-1 bg-[#F7FAFC]">
          {src ? (
            <>
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 font-mono text-xs text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Memuat pratinjau...
                </div>
              )}
              <iframe
                title="Pratinjau berkas"
                src={src}
                onLoad={() => setLoaded(true)}
                className="h-full w-full border-0"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
              />
            </>
          ) : (
            <p className="p-6 text-sm text-secondary">Pratinjau tidak tersedia untuk link ini. Gunakan tombol Buka.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Kartu link terstruktur: jenis, judul, ID ringkas, status akses (publik/privat), dan aksi
 * Pratinjau / Buka / Salin / Cek ulang. `check` boleh null selagi menunggu hasil server.
 */
export function LinkCard({
  url,
  check,
  checking = false,
  onRecheck,
  compact = false,
}: {
  url: string;
  check: LinkCheck | null;
  checking?: boolean;
  onRecheck?: () => void;
  compact?: boolean;
}) {
  const local = parseShareLink(url);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const provider = check?.provider || local?.provider || "web";
  const label = check?.label || local?.label || "Tautan";
  const id = check?.id || local?.id || null;
  const openUrl = check?.normalized_url || local?.normalizedUrl || url;
  const title = check?.title || label;
  const canPreview = Boolean(check?.can_preview && check.access === "public");
  const danger = check?.access === "private" || check?.access === "missing";

  async function copy() {
    try {
      await navigator.clipboard.writeText(openUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard diblokir browser: abaikan */
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-3 bg-white p-3 shadow-[0_-2px_0_0_var(--c),0_2px_0_0_var(--c),-2px_0_0_0_var(--c),2px_0_0_0_var(--c)] ${compact ? "" : "sm:p-4"}`}
        style={{ ["--c" as string]: danger ? "#FDA4AF" : check?.access === "public" ? "#99D5CC" : "#D9E5ED" }}
      >
        <span className={`px-icon h-10 w-10 shrink-0 ${danger ? "!bg-[#FFF1F2] !text-[#BE123C]" : ""}`}>
          <ProviderIcon provider={provider} label={label} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-sm font-bold text-foreground">{title}</p>
            <StatusPill access={check?.access ?? null} checking={checking} />
          </div>
          <p className="truncate font-mono text-[11px] text-secondary">
            {title !== label ? `${label} · ` : ""}
            {id ? shortId(id) : local?.host ?? ""}
          </p>
        </div>
      </div>

      <LinkAccessWarning check={check} provider={provider} />
      {check?.access === "public" && (
        <p className="flex items-center gap-1.5 text-xs text-[#0F766E]">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {check.message}
        </p>
      )}
      {check?.access === "unknown" && <p className="text-xs text-secondary">{check.message}</p>}

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
        {canPreview && (
          <button type="button" onClick={() => setPreview(true)} className="px-btn inline-flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-bold">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Pratinjau
          </button>
        )}
        <a href={openUrl} target="_blank" rel="noopener noreferrer" className="px-btn-ghost inline-flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-bold">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Buka
        </a>
        <button type="button" onClick={copy} className="px-btn-ghost inline-flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-bold">
          {copied ? <Check className="h-3.5 w-3.5 text-[#0F766E]" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          <span role="status">{copied ? "Tersalin" : "Salin link"}</span>
        </button>
        {onRecheck && (
          <button type="button" onClick={onRecheck} disabled={checking} className="px-btn-ghost inline-flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-bold">
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} aria-hidden="true" />
            Cek ulang
          </button>
        )}
      </div>

      {preview && check && <PreviewDialog check={check} onClose={() => setPreview(false)} />}
    </div>
  );
}
