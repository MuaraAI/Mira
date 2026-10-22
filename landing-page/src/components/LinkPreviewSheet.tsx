"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import type { LinkCheck } from "@/lib/links";
import { LinkAccessWarning } from "@/components/LinkAccessWarning";
import { SheetTabs } from "@/components/SheetTabs";
import { SideSheet } from "@/components/SideSheet";

type Tab = "info" | "pratinjau";

const PREVIEW_HOSTS = new Set(["drive.google.com", "docs.google.com", "www.youtube-nocookie.com"]);

const ACCESS_TEXT: Record<LinkCheck["access"], string> = {
  public: "Publik: siapa pun yang punya link bisa membukanya",
  private: "Belum publik: orang lain diminta login atau tidak punya akses",
  missing: "Tidak ditemukan atau sudah dihapus",
  invalid: "Bukan link yang valid",
  unknown: "Belum bisa dipastikan",
};

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">{term}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Panel pratinjau link tugas: tab Info (jenis, status akses, ID, link bersih) dan tab Pratinjau
 * (tampilan berkas/folder). Tampilannya sama dengan panel pratinjau soal dan bahan ajar.
 */
export function LinkPreviewSheet({ check, onClose }: { check: LinkCheck; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(check.can_preview ? "pratinjau" : "info");
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [copied, setCopied] = useState(false);

  let src: string | null = null;
  try {
    const target = new URL(check.preview_url ?? "");
    if (target.protocol === "https:" && PREVIEW_HOSTS.has(target.hostname)) src = target.toString();
  } catch {
    src = null;
  }
  const isFolder = check.kind === "folder";
  const openUrl = check.normalized_url || check.url;

  // Google kadang membiarkan iframe kosong tanpa memberi kabar: tawarkan jalan keluar setelah beberapa detik.
  useEffect(() => {
    if (tab !== "pratinjau" || loaded) return;
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [tab, loaded]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(openUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard diblokir browser */
    }
  }

  return (
    <SideSheet
      open
      onClose={onClose}
      eyebrow={isFolder ? "Pratinjau folder" : "Pratinjau berkas"}
      title={check.title || check.label}
      subtitle={check.title ? check.label : undefined}
      titleId="link-preview-title"
      width="xl"
      flush
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={copy} className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-bold">
            {copied ? <Check className="h-4 w-4 text-[#0F766E]" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            <span role="status">{copied ? "Tersalin" : "Salin link"}</span>
          </button>
          <a href={openUrl} target="_blank" rel="noopener noreferrer" className="px-btn inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-bold">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Buka di tab baru
          </a>
        </div>
      }
    >
      <SheetTabs
        label="Tampilan link"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "info", label: "Info" },
          { key: "pratinjau", label: "Pratinjau" },
        ]}
      />

      {tab === "info" ? (
        <div className="max-w-3xl space-y-5 p-4 sm:p-6">
          <LinkAccessWarning check={check} provider={check.provider} />
          <dl className="space-y-3.5">
            <Row term="Jenis">{check.label}</Row>
            {check.title && <Row term="Nama">{check.title}</Row>}
            <Row term="Akses">{ACCESS_TEXT[check.access]}</Row>
            {check.id && (
              <Row term="ID">
                <span className="font-mono text-xs">{check.id}</span>
              </Row>
            )}
            <Row term="Link bersih">
              <span className="break-all font-mono text-xs text-[#0369A1]">{openUrl}</span>
            </Row>
          </dl>
          {!check.can_preview && check.access !== "private" && check.access !== "missing" && (
            <p className="border-l-4 border-px-soft bg-px-tint px-3 py-2 text-xs leading-relaxed text-secondary">
              Pratinjau tidak tersedia untuk jenis link ini. Gunakan tombol Buka di tab baru untuk melihat isinya.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          <p className="border-b-2 border-dashed border-px-soft bg-px-tint px-4 py-2 text-[11px] leading-relaxed text-secondary">
            {isFolder
              ? "Isi folder seperti yang dilihat dosen. Folder yang belum publik tampil kosong atau meminta login."
              : "Tampilan berkas seperti yang dilihat dosen. Kalau kosong atau meminta login, link belum publik."}
          </p>
          <div className="relative h-[calc(92dvh-17rem)] min-h-[18rem] bg-[#F7FAFC] sm:h-[calc(100dvh-17rem)]">
            {src ? (
              <>
                {!loaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center font-mono text-xs text-secondary">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Memuat pratinjau...
                    </span>
                    {slow && (
                      <a href={openUrl} target="_blank" rel="noopener noreferrer" className="px-btn-ghost inline-flex min-h-10 items-center gap-2 px-3 font-bold">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        Lama? Buka di tab baru
                      </a>
                    )}
                  </div>
                )}
                <iframe
                  title="Pratinjau link"
                  src={src}
                  onLoad={() => setLoaded(true)}
                  className="absolute inset-0 h-full w-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
                  allow="fullscreen; autoplay"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                />
              </>
            ) : (
              <p className="p-6 text-sm text-secondary">Pratinjau tidak tersedia untuk link ini. Gunakan tombol Buka di tab baru.</p>
            )}
          </div>
        </div>
      )}
    </SideSheet>
  );
}
