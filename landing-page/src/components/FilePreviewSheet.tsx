"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Minus, Plus, TriangleAlert } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { apiBlob, ApiError, saveBlob } from "@/lib/api";
import { extractPages, isPdfBlob, openPdf, renderPage } from "@/lib/pdf";
import { summarizePdfText, type PdfSummary } from "@/lib/summarize";
import { SheetTabs } from "@/components/SheetTabs";
import { SideSheet } from "@/components/SideSheet";

type Tab = "ringkasan" | "pratinjau";
type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "other"; blob: Blob; filename: string }
  | { state: "broken"; blob: Blob; filename: string }
  | { state: "ready"; blob: Blob; filename: string; doc: PDFDocumentProxy };

const ZOOMS = [1, 1.5, 2] as const;
// Ringkasan sudah dihitung sekali per berkas; membuka ulang panel tidak mengulang pekerjaan.
const summaryCache = new Map<string, PdfSummary | "scan">();

/**
 * Panel pratinjau + ringkasan otomatis untuk berkas PDF (soal tugas, bahan ajar).
 * Semua diproses di browser: berkas diunduh sekali, dirender dengan pdf.js dan diringkas
 * dari teksnya, tanpa beban tambahan di server.
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
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [summary, setSummary] = useState<PdfSummary | "scan" | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let doc: PDFDocumentProxy | null = null;
    setTab("ringkasan");
    setLoad({ state: "loading" });
    setSummary(summaryCache.get(path) ?? null);

    (async () => {
      try {
        const { blob, filename } = await apiBlob(path, defaultFilename);
        if (!alive) return;
        // Nama .pdf atau tipe application/pdf cukup sebagai petunjuk; pdf.js yang menentukan bisa dibuka atau tidak.
        const claimsPdf = (await isPdfBlob(blob)) || /\.pdf$/i.test(filename) || /pdf/i.test(blob.type);
        if (!claimsPdf) {
          setLoad({ state: "other", blob, filename });
          return;
        }
        try {
          doc = await openPdf(blob);
        } catch (err) {
          if (err instanceof Error && /password/i.test(err.message)) throw err;
          if (!alive) return;
          setLoad({ state: "broken", blob, filename });
          return;
        }
        if (!alive) {
          void doc.destroy();
          return;
        }
        setLoad({ state: "ready", blob, filename, doc });
        if (!summaryCache.has(path)) {
          const pages = await extractPages(doc);
          if (!alive) return;
          const text = pages.join("").trim();
          const result = text.length < 40 ? "scan" : summarizePdfText(pages);
          if (summaryCache.size >= 8) summaryCache.delete(summaryCache.keys().next().value as string);
          summaryCache.set(path, result);
          setSummary(result);
        }
      } catch (err) {
        if (!alive) return;
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error && /password/i.test(err.message)
            ? "PDF ini dilindungi kata sandi, jadi tidak bisa ditampilkan."
            : "Berkas tidak bisa dibuka. Coba unduh langsung.";
        setLoad({ state: "error", message });
      }
    })();

    return () => {
      alive = false;
      void doc?.destroy();
    };
  }, [open, path, defaultFilename]);

  const file = load.state === "ready" || load.state === "other" || load.state === "broken" ? load : null;

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
      footer={
        <button
          type="button"
          disabled={!file}
          onClick={() => file && saveBlob(file.blob, file.filename)}
          className="px-btn inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-bold"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {file ? `Unduh ${file.filename.length > 28 ? "berkas" : file.filename}` : "Menyiapkan berkas..."}
        </button>
      }
    >
      {load.state === "error" ? (
        <Notice message={load.message} />
      ) : load.state === "broken" ? (
        <Notice message="Berkas ini tidak bisa ditampilkan di aplikasi (formatnya tidak terbaca). Unduh berkasnya untuk membukanya di aplikasi PDF." />
      ) : load.state === "other" ? (
        <Notice message="Pratinjau dan ringkasan otomatis hanya tersedia untuk berkas PDF. Unduh berkas ini untuk membukanya." />
      ) : (
        <div>
          <SheetTabs
            label="Tampilan berkas"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "ringkasan", label: "Ringkasan" },
              { key: "pratinjau", label: "Pratinjau" },
            ]}
          />

          {load.state === "loading" ? (
            <div className="space-y-3 p-4 sm:p-6" aria-busy="true" aria-label="Memuat berkas">
              <div className="px-skeleton h-5 w-2/3" />
              <div className="px-skeleton h-4 w-full" />
              <div className="px-skeleton h-4 w-11/12" />
              <div className="px-skeleton h-4 w-4/5" />
              <div className="px-skeleton h-40 w-full" />
            </div>
          ) : tab === "ringkasan" ? (
            <SummaryView summary={summary} />
          ) : (
            <PdfPages doc={load.doc} />
          )}
        </div>
      )}
    </SideSheet>
  );
}

function Notice({ message }: { message: string }) {
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

function SummaryView({ summary }: { summary: PdfSummary | "scan" | null }) {
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

function PdfPages({ doc }: { doc: PDFDocumentProxy }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [width, setWidth] = useState(0);
  const [ratio, setRatio] = useState(1.414);

  useEffect(() => {
    let alive = true;
    void doc.getPage(1).then((page) => {
      const v = page.getViewport({ scale: 1 });
      if (alive) setRatio(v.height / v.width);
    });
    return () => {
      alive = false;
    };
  }, [doc]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      setWidth(Math.floor(el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cssWidth = width * zoom;
  const zoomIndex = ZOOMS.indexOf(zoom);

  return (
    <div className="p-2 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-secondary">{doc.numPages} halaman</span>
        <div className="flex items-center gap-1" role="group" aria-label="Perbesar tampilan">
          <button
            type="button"
            onClick={() => setZoom(ZOOMS[Math.max(0, zoomIndex - 1)])}
            disabled={zoomIndex === 0}
            aria-label="Perkecil"
            className="px-btn-ghost flex min-h-10 min-w-10 items-center justify-center"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="w-12 text-center font-mono text-xs font-bold text-foreground">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomIndex + 1)])}
            disabled={zoomIndex === ZOOMS.length - 1}
            aria-label="Perbesar"
            className="px-btn-ghost flex min-h-10 min-w-10 items-center justify-center"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div ref={wrapRef} className="overflow-x-auto bg-[#E7EFF5] p-2 sm:p-3">
        <div className="space-y-3" style={{ width: cssWidth ? cssWidth : undefined }}>
          {width > 0 &&
            Array.from({ length: doc.numPages }, (_, i) => (
              <PageCanvas key={i} doc={doc} pageNumber={i + 1} width={Math.max(cssWidth - 0, 1)} ratio={ratio} />
            ))}
        </div>
      </div>
    </div>
  );
}

/** Halaman dirender hanya saat mendekati layar, supaya PDF panjang tetap ringan di HP. */
function PageCanvas({ doc, pageNumber, width, ratio }: { doc: PDFDocumentProxy; pageNumber: number; width: number; ratio: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "700px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(async () => {
    if (canvas.current) await renderPage(doc, pageNumber, canvas.current, width);
  }, [doc, pageNumber, width]);

  useEffect(() => {
    const el = canvas.current;
    if (!near) {
      // Halaman jauh dari layar: lepaskan memori bitmap, digambar ulang saat mendekat.
      if (el) {
        el.width = 0;
        el.height = 0;
      }
      return;
    }
    void draw().catch(() => {
      /* render dibatalkan saat panel ditutup */
    });
  }, [near, draw]);

  return (
    <div ref={holder} className="bg-white shadow-[3px_3px_0_0_#9CC6E0]" style={{ width, height: width * ratio }}>
      <canvas ref={canvas} className="block" aria-label={`Halaman ${pageNumber}`} role="img" />
    </div>
  );
}
