"use client";

import { useEffect, useState } from "react";
import { Download, FileText, TriangleAlert, X } from "lucide-react";
import { saveBlob } from "@/lib/api";
import { useRemoteFile, type FileState } from "@/lib/remote-file";
import type { PdfSummary } from "@/lib/summarize";
import { PdfViewer } from "@/components/PdfViewer";
import { SheetTabs } from "@/components/SheetTabs";
import { SideSheet } from "@/components/SideSheet";

type Tab = "pratinjau" | "ringkasan";

export function PreviewSkeleton() {
  return (
    <div className="space-y-3 p-4 sm:p-6" aria-busy="true" aria-label="Memuat berkas">
      <div className="px-skeleton h-5 w-2/3" />
      <div className="px-skeleton h-[55dvh] w-full" />
    </div>
  );
}

export function ImageView({ url, name }: { url: string; name: string }) {
  return (
    <div className="h-full overflow-auto bg-[#E7EFF5] p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} className="mx-auto h-auto max-w-full bg-white shadow-[3px_3px_0_0_#9CC6E0]" />
    </div>
  );
}

export function UpdatedNotice({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-[#99D5CC] bg-[#F0FDF4] px-4 py-2 text-xs font-semibold text-[#0F766E]" role="status">
      <span>Berkas baru saja diperbarui. Tampilan sudah diganti ke versi terbaru.</span>
      <button type="button" onClick={onClose} aria-label="Tutup pemberitahuan" className="flex min-h-9 min-w-9 items-center justify-center">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Berkas yang bisa diunduh (apa pun jenisnya), atau null selagi belum siap. */
export function downloadable(state: FileState) {
  return state.phase === "pdf" || state.phase === "image" || state.phase === "other" || state.phase === "broken" ? state : null;
}

/** Pesan untuk keadaan gagal/tidak didukung; null bila berkas siap ditampilkan atau masih dimuat. */
export function stateNotice(state: FileState): string | null {
  if (state.phase === "error") return state.message;
  if (state.phase === "other") return "Pratinjau dan ringkasan otomatis hanya tersedia untuk berkas PDF dan gambar. Unduh berkas ini untuk membukanya.";
  if (state.phase === "broken") return "Berkas ini tidak bisa ditampilkan di aplikasi (formatnya tidak terbaca). Unduh berkasnya untuk membukanya di aplikasi PDF.";
  return null;
}

/**
 * Panel pratinjau + ringkasan otomatis untuk berkas PDF (soal tugas, bahan ajar).
 * Berkas diunduh sekali dan disimpan di memori: membuka lagi langsung tampil, lalu dicek ke server
 * di belakang layar (hanya diganti bila isinya berubah). Pindah tab tidak memuat ulang apa pun.
 */
export function FilePreviewSheet({
  open,
  onClose,
  path,
  title,
  subtitle,
  eyebrow = "Berkas",
  defaultFilename = "berkas.pdf",
}: {
  open: boolean;
  onClose: () => void;
  /** Path API untuk mengunduh berkas, mis. /v1/elearning/materials/download?id=...&file=... */
  path: string;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  defaultFilename?: string;
}) {
  const file = useRemoteFile(open ? path : null, defaultFilename);
  const [tab, setTab] = useState<Tab>("pratinjau");
  const { state, summary, updated, dismissUpdated } = file;

  useEffect(() => {
    if (open) setTab("pratinjau");
  }, [open, path]);

  const ready = downloadable(state);
  const notice = stateNotice(state);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      titleId="file-preview-title"
      width="xl"
      flush
      fill
      footer={
        <button
          type="button"
          disabled={!ready}
          onClick={() => ready && saveBlob(ready.blob, ready.filename)}
          className="px-btn inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-bold"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {ready ? `Unduh ${ready.filename.length > 28 ? "berkas" : ready.filename}` : "Menyiapkan berkas..."}
        </button>
      }
    >
      {notice ? (
        <Notice message={notice} />
      ) : (
        <>
          {state.phase === "pdf" && (
            <SheetTabs
              label="Tampilan berkas"
              value={tab}
              onChange={setTab}
              tabs={[
                { key: "pratinjau", label: "Pratinjau" },
                { key: "ringkasan", label: "Ringkasan" },
              ]}
            />
          )}
          {updated && <UpdatedNotice onClose={dismissUpdated} />}

          {/* Kedua panel tetap terpasang; yang tidak aktif hanya disembunyikan supaya pindah tab tidak memuat ulang PDF. */}
          <div className={tab === "pratinjau" ? "min-h-0 flex-1" : "hidden"}>
            {state.phase === "loading" ? (
              <PreviewSkeleton />
            ) : state.phase === "pdf" ? (
              <PdfViewer doc={state.doc} active={tab === "pratinjau"} />
            ) : state.phase === "image" ? (
              <ImageView url={state.url} name={state.filename} />
            ) : null}
          </div>
          <div className={tab === "ringkasan" ? "min-h-0 flex-1 overflow-y-auto" : "hidden"}>
            <SummaryView summary={summary} />
          </div>
        </>
      )}
    </SideSheet>
  );
}

export function Notice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 p-4 text-sm text-[#9A3412] sm:p-6" role="alert">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function Block({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h4 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-[#0369A1]" />
        {heading}
      </h4>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
          <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 bg-[#7FB4D3]" />
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function SummaryView({ summary }: { summary: PdfSummary | "scan" | null }) {
  if (summary === null) {
    return (
      <div className="space-y-3 p-4 sm:p-6" aria-busy="true" aria-label="Menyusun ringkasan">
        <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-secondary">Menyusun ringkasan…</p>
        <div className="px-skeleton h-4 w-full" />
        <div className="px-skeleton h-4 w-11/12" />
        <div className="px-skeleton h-4 w-3/4" />
      </div>
    );
  }
  if (summary === "scan") {
    return <Notice message="PDF ini berupa gambar (hasil pindaian) sehingga teksnya tidak bisa dibaca otomatis. Buka tab Pratinjau untuk melihat isinya." />;
  }
  const empty = !summary.summary.length && !summary.tasks.length;
  return (
    <div className="max-w-3xl space-y-6 p-4 sm:p-6">
      {summary.title && <h3 className="break-words font-display text-lg font-bold leading-snug text-foreground">{summary.title}</h3>}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-secondary">
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {summary.pages} halaman
        </span>
        <span>{summary.words.toLocaleString("id-ID")} kata</span>
      </p>

      {empty ? (
        <Notice message="Isi berkas terlalu sedikit untuk diringkas. Lihat tab Pratinjau." />
      ) : (
        <>
          {summary.tasks.length > 0 && (
            <Block heading="Yang perlu dikerjakan">
              <Bullets items={summary.tasks} />
            </Block>
          )}
          {summary.summary.length > 0 && (
            <Block heading="Ringkasan isi">
              <Bullets items={summary.summary} />
            </Block>
          )}
          {summary.outline.length > 0 && (
            <Block heading="Isi dokumen">
              <ol className="space-y-1 pl-1 text-sm text-secondary">
                {summary.outline.map((o, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="w-5 shrink-0 text-right font-mono text-xs text-[#0369A1]">{i + 1}</span>
                    <span className="min-w-0 break-words">{o}</span>
                  </li>
                ))}
              </ol>
            </Block>
          )}
          {summary.keywords.length > 0 && (
            <Block heading="Kata kunci">
              <div className="flex flex-wrap gap-2">
                {summary.keywords.map((k) => (
                  <span key={k} className="bg-px-tint px-2 py-1 font-mono text-xs text-[#0369A1]">
                    {k}
                  </span>
                ))}
              </div>
            </Block>
          )}
        </>
      )}

      <p className="border-l-4 border-px-soft bg-px-tint px-3 py-2 text-xs leading-relaxed text-secondary">
        Ringkasan disusun otomatis dari teks PDF (bukan AI) dan bisa melewatkan detail. Selalu cek berkas aslinya untuk ketentuan lengkap.
      </p>
    </div>
  );
}

