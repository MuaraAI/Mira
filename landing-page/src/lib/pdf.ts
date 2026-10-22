import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");
let loader: Promise<PdfJs> | null = null;

/** pdf.js dimuat hanya saat pratinjau PDF dibuka, supaya halaman lain tetap ringan. */
function pdfjs(): Promise<PdfJs> {
  loader ??= import("pdfjs-dist/legacy/build/pdf").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
    return lib as unknown as PdfJs;
  });
  return loader;
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

/** Teks per halaman, baris disusun ulang dari posisi vertikal. */
export async function extractPages(doc: PDFDocumentProxy, maxPages = 60): Promise<string[]> {
  const out: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
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
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) => row.sort((a, b) => a.x - b.x).map((c) => c.text).join(" ").replace(/\s+/g, " ").trim());
    out.push(lines.join("\n"));
    page.cleanup();
  }
  return out;
}

export async function renderPage(doc: PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number) {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (cssWidth * dpr) / base.width;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${(base.height / base.width) * cssWidth}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
}
