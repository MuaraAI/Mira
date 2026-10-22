"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { apiBlob, ApiError } from "@/lib/api";
import { extractPages, isPdfBlob, openPdf } from "@/lib/pdf";
import { summarizePdfText, type PdfSummary } from "@/lib/summarize";

export type Summary = PdfSummary | "scan";

export type FileState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "other"; blob: Blob; filename: string }
  | { phase: "broken"; blob: Blob; filename: string }
  | { phase: "image"; blob: Blob; filename: string; url: string }
  | { phase: "pdf"; blob: Blob; filename: string; doc: PDFDocumentProxy };

interface Entry {
  blob: Blob;
  filename: string;
  etag: string | null;
  checkedAt: number;
  summary?: Summary;
}

// Salinan berkas di memori browser: buka-ulang langsung tampil, lalu dicek ke server di belakang layar.
const store = new Map<string, Entry>();
const STORE_LIMIT = 6;
const RECHECK_AFTER_MS = 4_000;
const POLL_MS = 20_000;

function remember(path: string, entry: Entry) {
  store.delete(path);
  store.set(path, entry);
  while (store.size > STORE_LIMIT) store.delete(store.keys().next().value as string);
}

/** Isi dua berkas sama persis? (dipakai bila server tidak mengirim ETag yang terbaca) */
async function sameContent(a: Blob, b: Blob) {
  if (a.size !== b.size) return false;
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-1", await a.arrayBuffer()), crypto.subtle.digest("SHA-1", await b.arrayBuffer())]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  return xa.every((v, i) => v === ya[i]);
}

function messageFor(err: unknown) {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && /password/i.test(err.message)) return "PDF ini dilindungi kata sandi, jadi tidak bisa ditampilkan.";
  return "Berkas tidak bisa dibuka. Coba unduh langsung.";
}

/**
 * Muat berkas dari API: tampil seketika dari salinan memori bila ada, dicek ulang ke server memakai
 * ETag (304 = tidak ada yang berubah, tidak ada yang dimuat ulang) dan dicek berkala selagi dibuka.
 * Berkas baru hanya menggantikan tampilan bila isinya memang berubah.
 */
export function useRemoteFile(path: string | null, defaultFilename: string) {
  const [state, setState] = useState<FileState>({ phase: "loading" });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [updated, setUpdated] = useState(false);
  const live = useRef<{ doc: PDFDocumentProxy | null; url: string | null }>({ doc: null, url: null });
  const gen = useRef(0);

  const release = useCallback((previous = live.current) => {
    void previous.doc?.destroy();
    if (previous.url) URL.revokeObjectURL(previous.url);
  }, []);

  // Tampilan lama dilepas sesaat setelah yang baru terpasang, supaya penampil tidak menggambar dokumen yang sudah dihancurkan.
  const swap = useCallback(
    (next: { doc: PDFDocumentProxy | null; url: string | null }) => {
      const previous = live.current;
      live.current = next;
      window.setTimeout(() => release(previous), 400);
    },
    [release],
  );

  const show = useCallback(
    async (key: string, entry: Entry, token: number): Promise<boolean> => {
      const { blob, filename } = entry;
      if (blob.type.startsWith("image/")) {
        const url = URL.createObjectURL(blob);
        if (token !== gen.current) return URL.revokeObjectURL(url), false;
        swap({ doc: null, url });
        setState({ phase: "image", blob, filename, url });
        setSummary(null);
        return true;
      }
      const claimsPdf = (await isPdfBlob(blob)) || /\.pdf$/i.test(filename) || /pdf/i.test(blob.type);
      if (!claimsPdf) {
        if (token === gen.current) setState({ phase: "other", blob, filename });
        return false;
      }
      let doc: PDFDocumentProxy;
      try {
        doc = await openPdf(blob);
      } catch (err) {
        if (err instanceof Error && /password/i.test(err.message)) throw err;
        if (token === gen.current) setState({ phase: "broken", blob, filename });
        return false;
      }
      if (token !== gen.current) {
        void doc.destroy();
        return false;
      }
      swap({ doc, url: null });
      setState({ phase: "pdf", blob, filename, doc });
      setSummary(entry.summary ?? null);

      if (!entry.summary) {
        // Ringkasan disusun setelah halaman pertama tampil supaya tidak menghambat pratinjau.
        window.setTimeout(async () => {
          if (token !== gen.current) return;
          const pages = await extractPages(doc, 60, () => token !== gen.current).catch(() => null);
          if (!pages || token !== gen.current) return;
          const result: Summary = pages.join("").trim().length < 40 ? "scan" : summarizePdfText(pages);
          entry.summary = result;
          setSummary(result);
        }, 350);
      }
      return true;
    },
    [swap],
  );

  useEffect(() => {
    if (!path) return;
    const token = ++gen.current;
    let alive = true;
    let timer: number | null = null;
    setUpdated(false);

    const check = async (initial: boolean) => {
      const cached = store.get(path);
      if (cached && !initial && Date.now() - cached.checkedAt < RECHECK_AFTER_MS) return;
      try {
        const res = await apiBlob(path, defaultFilename, { etag: cached?.etag });
        if (!alive || token !== gen.current) return;
        if (res.notModified && cached) {
          cached.checkedAt = Date.now();
          return;
        }
        if (cached && (await sameContent(cached.blob, res.blob))) {
          // Isi tidak berubah: tidak perlu memuat ulang tampilan.
          cached.etag = res.etag ?? cached.etag;
          cached.checkedAt = Date.now();
          return;
        }
        const entry: Entry = { blob: res.blob, filename: res.filename, etag: res.etag, checkedAt: Date.now() };
        remember(path, entry);
        const shown = await show(path, entry, token);
        if (shown && cached && !initial) setUpdated(true);
      } catch (err) {
        // Gagal saat pengecekan di belakang layar: tampilan yang ada tetap dipakai.
        if (alive && token === gen.current && (initial || !cached)) setState({ phase: "error", message: messageFor(err) });
      }
    };

    const cached = store.get(path);
    if (cached) {
      setState({ phase: "loading" });
      void show(path, cached, token)
        .then(() => {
          if (alive) return check(false);
        })
        .catch((err) => alive && setState({ phase: "error", message: messageFor(err) }));
    } else {
      setState({ phase: "loading" });
      setSummary(null);
      void check(true);
    }

    const tick = () => {
      if (document.visibilityState === "visible") void check(false);
      timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      gen.current++;
      release();
      live.current = { doc: null, url: null };
    };
  }, [path, defaultFilename, show, release]);

  return { state, summary, updated, dismissUpdated: () => setUpdated(false) };
}
