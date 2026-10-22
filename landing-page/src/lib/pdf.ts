import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");
let loader: Promise<PdfJs> | null = null;

/** pdf.js dimuat hanya saat dibutuhkan, supaya halaman lain tetap ringan. */
function pdfjs(): Promise<PdfJs> {
  loader ??= import("pdfjs-dist/legacy/build/pdf").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
    return lib as unknown as PdfJs;
  });
  return loader;
}

/** Panaskan pdf.js (modul + worker) saat browser menganggur, supaya pratinjau pertama langsung terbuka. */
export function preloadPdfjs() {
  if (typeof window === "undefined") return;
  const warm = () => {
    void pdfjs().catch(() => {
      loader = null;
    });
    void fetch("/pdfjs/pdf.worker.min.js", { priority: "low" } as RequestInit).catch(() => {});
  };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (idle) idle(warm);
  else window.setTimeout(warm, 1500);
}

/** Spesifikasi PDF mengizinkan "%PDF-" muncul di 1024 byte pertama (mis. setelah spasi atau BOM). */
export async function isPdfBlob(blob: Blob) {
  const head = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  const marker = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  for (let i = 0; i + marker.length <= head.length; i++) {
    if (marker.every((byte, j) => head[i + j] === byte)) return true;
  }
  return false;
}

export async function openPdf(blob: Blob): Promise<PDFDocumentProxy> {
  const lib = await pdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  return lib.getDocument({ data, isEvalSupported: false }).promise;
}

async function pageText(doc: PDFDocumentProxy, n: number): Promise<string> {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  const rows = new Map<number, { x: number; text: string }[]>();
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const y = Math.round(item.transform[5] / 3);
    const row = rows.get(y) ?? [];
    row.push({ x: item.transform[4], text: item.str });
    rows.set(y, row);
  }
  page.cleanup();
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => row.sort((a, b) => a.x - b.x).map((c) => c.text).join(" ").replace(/\s+/g, " ").trim())
    .join("\n");
}

/** Teks per halaman (baris disusun ulang dari posisi vertikal), diambil beberapa halaman sekaligus. */
export async function extractPages(doc: PDFDocumentProxy, maxPages = 60, isCancelled: () => boolean = () => false): Promise<string[]> {
  const total = Math.min(doc.numPages, maxPages);
  const out: string[] = new Array(total).fill("");
  const batch = 4;
  for (let start = 1; start <= total; start += batch) {
    if (isCancelled()) break;
    const numbers = Array.from({ length: Math.min(batch, total - start + 1) }, (_, i) => start + i);
    const texts = await Promise.all(numbers.map((n) => pageText(doc, n)));
    texts.forEach((text, i) => (out[start + i - 1] = text));
  }
  return out;
}

/** Rasio tinggi/lebar tiap halaman, supaya tempat halaman tidak melompat saat digambar. */
export async function pageRatios(doc: PDFDocumentProxy, limit = 120): Promise<number[]> {
  const total = Math.min(doc.numPages, limit);
  const ratios = await Promise.all(
    Array.from({ length: total }, async (_, i) => {
      const page = await doc.getPage(i + 1);
      const v = page.getViewport({ scale: 1 });
      page.cleanup();
      return v.height / v.width;
    }),
  );
  return ratios;
}

/** Batas lebar bitmap supaya zoom besar di HP tidak menghabiskan memori. */
const MAX_BITMAP_WIDTH = 2600;

export function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): { promise: Promise<void>; cancel: () => void } {
  let task: RenderTask | null = null;
  let cancelled = false;
  const promise = (async () => {
    const page = await doc.getPage(pageNumber);
    if (cancelled) return;
    const base = page.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.min(cssWidth * dpr, MAX_BITMAP_WIDTH);
    const viewport = page.getViewport({ scale: pixelWidth / base.width });
    // Gambar di kanvas cadangan lalu salin, supaya halaman tidak berkedip kosong saat digambar ulang.
    const buffer = document.createElement("canvas");
    buffer.width = Math.floor(viewport.width);
    buffer.height = Math.floor(viewport.height);
    const ctx = buffer.getContext("2d");
    if (!ctx) return;
    task = page.render({ canvasContext: ctx, viewport });
    await task.promise;
    if (cancelled) return;
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    canvas.getContext("2d")?.drawImage(buffer, 0, 0);
    page.cleanup();
  })();
  return {
    promise,
    cancel: () => {
      cancelled = true;
      task?.cancel();
    },
  };
}
