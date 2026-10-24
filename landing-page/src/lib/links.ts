"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export type LinkAccess = "public" | "private" | "missing" | "unknown" | "invalid";

export interface LinkCheck {
  url: string;
  valid: boolean;
  provider: string | null;
  kind: string | null;
  label: string;
  id: string | null;
  normalized_url: string | null;
  preview_url: string | null;
  can_preview: boolean;
  access: LinkAccess;
  title: string | null;
  message: string;
}

export interface ParsedLink {
  provider: "google_drive" | "google_docs" | "github" | "youtube" | "web";
  label: string;
  id: string | null;
  normalizedUrl: string;
  host: string;
  /** open?id=... : bisa berkas atau folder, jenis pastinya baru diketahui dari pengecekan server. */
  ambiguous?: boolean;
}

const ID = "[A-Za-z0-9_-]{10,}";

/** Rapikan input mentah: buang kutip/kurung sudut, ambil URL dari teks bebas, tambah https:// bila hilang. */
export function cleanUrl(raw: string): string {
  const text = raw.trim().replace(/^[<"']+|[>"']+$/g, "");
  const found = text.match(/https?:\/\/[^\s<>"']+/);
  if (found) return found[0].replace(/[.,;)]+$/, "");
  const first = text.split(/\s+/)[0] ?? "";
  if (first && !/^[a-z][a-z0-9+.-]*:/i.test(first) && /^(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:[/?#]|$)/.test(first)) return `https://${first}`;
  return text;
}

/** Urai link di browser supaya struktur langsung tampil sebelum hasil pengecekan server tiba. */
export function parseShareLink(raw: string): ParsedLink | null {
  let url: URL;
  try {
    url = new URL(cleanUrl(raw));
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname;
  const base = { provider: "web" as const, label: "Tautan web", id: null, normalizedUrl: url.toString(), host };
  const idPattern = new RegExp(`^${ID}$`);
  const queryId = url.searchParams.get("id");
  const validQueryId = queryId && idPattern.test(queryId) ? queryId : null;

  if (host === "drive.google.com" || host === "drive.usercontent.google.com") {
    const folder = path.match(new RegExp(`/folders/(${ID})`));
    const folderId = folder?.[1] ?? (/\/folderview\/?$/.test(path) ? validQueryId : null);
    if (folderId) return { ...base, provider: "google_drive", label: "Folder Google Drive", id: folderId, normalizedUrl: `https://drive.google.com/drive/folders/${folderId}` };
    const file = path.match(new RegExp(`/file/(?:u/\\d+/)?d/(${ID})`));
    const id = file?.[1] ?? validQueryId;
    if (id) {
      const ambiguous = !file && /\/open\/?$/.test(path);
      return {
        ...base,
        provider: "google_drive",
        label: ambiguous ? "Google Drive (berkas atau folder)" : "Berkas Google Drive",
        id,
        // open?id=... jangan dipaksa jadi link berkas: bisa saja folder.
        normalizedUrl: ambiguous ? url.toString() : `https://drive.google.com/file/d/${id}/view`,
        ambiguous,
      };
    }
    return { ...base, provider: "google_drive", label: "Google Drive (tautan tidak lengkap)" };
  }
  if (host === "docs.google.com") {
    const published = path.match(new RegExp(`^/(document|spreadsheets|presentation)/d/e/(${ID})`));
    const labels: Record<string, string> = {
      document: "Dokumen Google Docs",
      spreadsheets: "Spreadsheet Google Sheets",
      presentation: "Presentasi Google Slides",
      forms: "Formulir Google Forms",
    };
    if (published) {
      const tail = published[1] === "spreadsheets" ? "pubhtml" : "pub";
      return {
        ...base,
        provider: "google_docs",
        label: `${labels[published[1]]} (dipublikasikan)`,
        id: published[2],
        normalizedUrl: `https://docs.google.com/${published[1]}/d/e/${published[2]}/${tail}`,
      };
    }
    const match = path.match(new RegExp(`^/(document|spreadsheets|presentation|forms)/(?:u/\\d+/)?d/(${ID})`));
    if (match) {
      return {
        ...base,
        provider: "google_docs",
        label: labels[match[1]],
        id: match[2],
        normalizedUrl: match[1] === "forms" ? url.toString() : `https://docs.google.com/${match[1]}/d/${match[2]}/edit`,
      };
    }
    return { ...base, provider: "google_docs", label: "Google Docs (tautan tidak lengkap)" };
  }
  if (host === "github.com") {
    const parts = path.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const repo = parts[1].replace(/\.git$/, "");
      return { ...base, provider: "github", label: "Repository GitHub", id: `${parts[0]}/${repo}`, normalizedUrl: `https://github.com/${parts[0]}/${repo}` };
    }
    return { ...base, provider: "github", label: "GitHub" };
  }
  if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) {
    const segments = path.split("/").filter(Boolean);
    const vid = host === "youtu.be" ? segments[0] : ["shorts", "embed", "live"].includes(segments[0]) ? segments[1] : url.searchParams.get("v");
    if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid)) {
      return { ...base, provider: "youtube", label: "Video YouTube", id: vid, normalizedUrl: `https://www.youtube.com/watch?v=${vid}` };
    }
    return { ...base, provider: "youtube", label: "Tautan YouTube" };
  }
  return base;
}

/** Pastikan URL eksternal hanya memakai skema http/https yang aman (mencegah javascript:/data:/vbscript:). */
export function safeExternalHref(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {}
  return null;
}

/** Link yang "dirapikan" bila dikenali (Drive/Docs/GitHub); selain itu dikembalikan apa adanya. */
export function tidyLink(raw: string): string {
  const parsed = parseShareLink(raw);
  if (!parsed) return raw.trim();
  return parsed.provider !== "web" && parsed.id && !parsed.ambiguous ? parsed.normalizedUrl : cleanUrl(raw);
}

/** Hasil pengganti bila server tidak bisa dihubungi, supaya status tidak menggantung di "Mengecek". */
export function failedCheck(url: string): LinkCheck {
  return {
    url,
    valid: true,
    provider: null,
    kind: null,
    label: "",
    id: null,
    normalized_url: null,
    preview_url: null,
    can_preview: false,
    access: "unknown",
    title: null,
    message: "Status akses belum bisa dicek (server belum merespons). Tekan Cek ulang, atau pastikan link bisa dibuka tanpa login.",
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: LinkCheck }>();

async function requestChecks(urls: string[], refresh: boolean): Promise<LinkCheck[]> {
  const out: LinkCheck[] = [];
  for (let i = 0; i < urls.length; i += 20) {
    const res = await apiFetch<{ results: LinkCheck[] }>("/v1/tools/link-check", {
      json: { urls: urls.slice(i, i + 20), refresh },
    });
    out.push(...res.results);
  }
  return out;
}

/** Cek banyak link sekaligus (daftar tugas). Hasil di-cache di browser beberapa menit. */
export function useLinkChecks(urls: string[]) {
  const key = useMemo(() => Array.from(new Set(urls.filter(Boolean))).sort().join("\n"), [urls]);
  const [results, setResults] = useState<Record<string, LinkCheck>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async (list: string[], refresh: boolean) => {
    if (list.length === 0) return;
    setPending((prev) => new Set([...prev, ...list]));
    try {
      const checked = await requestChecks(list, refresh);
      const next: Record<string, LinkCheck> = {};
      checked.forEach((item, index) => {
        next[list[index]] = item;
        cache.set(list[index], { at: Date.now(), value: item });
      });
      if (alive.current) {
        setResults((prev) => ({ ...prev, ...next }));
        setFailed(false);
      }
    } catch {
      if (alive.current) {
        setFailed(true);
        setResults((prev) => ({ ...prev, ...Object.fromEntries(list.map((url) => [url, failedCheck(url)])) }));
      }
    } finally {
      if (alive.current) setPending((prev) => new Set([...prev].filter((u) => !list.includes(u))));
    }
  }, []);

  useEffect(() => {
    if (!key) return;
    const urlsNow = key.split("\n");
    const fresh: Record<string, LinkCheck> = {};
    const todo: string[] = [];
    for (const url of urlsNow) {
      const hit = cache.get(url);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) fresh[url] = hit.value;
      else todo.push(url);
    }
    if (Object.keys(fresh).length) setResults((prev) => ({ ...fresh, ...prev }));
    run(todo, false);
  }, [key, run]);

  const recheck = useCallback((url: string) => run([url], true), [run]);
  return { results, pending, failed, recheck };
}

/** Cek satu link yang sedang diketik (ditunda supaya tidak menembak server tiap huruf). */
export function useLinkCheck(url: string, delayMs = 700) {
  const trimmed = url.trim();
  const [result, setResult] = useState<LinkCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setResult(null);
    if (!trimmed || !parseShareLink(trimmed)) {
      setChecking(false);
      return;
    }
    let alive = true;
    setChecking(true);
    const timer = window.setTimeout(async () => {
      try {
        const [item] = await requestChecks([trimmed], tick > 0);
        if (alive) setResult(item ?? null);
      } catch {
        if (alive) setResult(failedCheck(trimmed));
      } finally {
        if (alive) setChecking(false);
      }
    }, delayMs);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [trimmed, delayMs, tick]);

  return { result, checking, recheck: () => setTick((t) => t + 1) };
}
