"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function getApiBase(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!envUrl) {
    throw new ApiError(
      "CONFIG_MISSING",
      "Variabel lingkungan NEXT_PUBLIC_API_URL belum disetel. Harap atur di file .env.local atau Vercel Project Settings.",
      0
    );
  }
  return envUrl.replace(/\/+$/, "");
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

interface EnvelopePayload {
  data?: unknown;
  detail?: { error?: { code?: string; message?: string } };
  error?: { code?: string; message?: string };
}

export async function apiFetch<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { json?: unknown }
): Promise<T> {
  const base = getApiBase();
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("ubsi_session_token")
      : null;
  const { json, ...rest } = init ?? {};
  const method = rest.method ?? (json !== undefined ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...rest,
      method,
      credentials: "include",
      cache: "no-store",
      headers: {
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(method !== "GET" ? { "X-Requested-With": "dashboard" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...rest.headers,
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Tidak dapat menghubungi server API. Pastikan backend berjalan di " +
        base,
      0
    );
  }

  let payload: EnvelopePayload | null = null;
  try {
    payload = (await res.json()) as EnvelopePayload;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const err = payload?.detail?.error ?? payload?.error;
    throw new ApiError(
      err?.code ?? `HTTP_${res.status}`,
      err?.message ?? `Permintaan gagal dengan status ${res.status}.`,
      res.status
    );
  }
  return payload?.data as T;
}

/** Ambil berkas sebagai Blob (dipakai unduhan, pratinjau, dan ringkasan PDF). */
export async function apiBlob(
  path: string,
  defaultFilename = "berkas.pdf"
): Promise<{ blob: Blob; filename: string }> {
  const base = getApiBase();
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("ubsi_session_token")
      : null;
  const fullUrl = path.startsWith("http") ? path : `${base}${path}`;

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        "X-Requested-With": "dashboard",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Tidak dapat menghubungi server API. Pastikan backend berjalan di " +
        base,
      0
    );
  }

  if (!res.ok) {
    let errMsg = `Gagal mengunduh berkas (HTTP ${res.status})`;
    try {
      const errPayload = await res.json();
      const err = errPayload?.detail?.error ?? errPayload?.error;
      if (err?.message) errMsg = err.message;
    } catch {}
    throw new ApiError(`HTTP_${res.status}`, errMsg, res.status);
  }

  let filename = defaultFilename;
  const disposition = res.headers.get("content-disposition");
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      filename = match[1].replace(/['"]/g, "").trim();
    }
  }

  return { blob: await res.blob(), filename };
}

/** Simpan Blob ke perangkat sebagai berkas unduhan. */
export function saveBlob(blob: Blob, filename: string) {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export async function apiDownload(
  path: string,
  defaultFilename = "berkas.pdf"
): Promise<void> {
  const { blob, filename } = await apiBlob(path, defaultFilename);
  saveBlob(blob, filename);
}

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 menit cache RAM di browser

export function setApiCache<T>(path: string, data: T) {
  memoryCache.set(path, { data, timestamp: Date.now() });
}

export function clearApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(pathPrefix)) {
      memoryCache.delete(key);
    }
  }
}

export function useApi<T>(
  path: string,
  options?: { ttlMs?: number; skipCache?: boolean; refreshMs?: number | null }
) {
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  const skipCache = options?.skipCache ?? false;
  const refreshMs = options?.refreshMs ?? null;

  const [state, setState] = useState<ApiState<T>>(() => {
    if (!path) {
      return { data: null, loading: false, error: null };
    }
    if (!skipCache && typeof window !== "undefined") {
      const cached = memoryCache.get(path) as CacheEntry<T> | undefined;
      if (cached && Date.now() - cached.timestamp < ttl) {
        return { data: cached.data, loading: false, error: null };
      }
    }
    return { data: null, loading: true, error: null };
  });

  const [tick, setTick] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;

    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const cached = memoryCache.get(path) as CacheEntry<T> | undefined;
    const isFresh = cached && Date.now() - cached.timestamp < ttl;

    // Jika sudah ada cache valid dan bukan dipicu reload() manual (tick === 0), pakai cache langsung
    if (!skipCache && isFresh && tick === 0) {
      if (state.data !== cached.data) {
        setState({ data: cached.data, loading: false, error: null });
      }
      return;
    }

    // Jika tidak ada data atau dipicu reload manual, tampilkan loading hanya bila data belum ada sama sekali
    if (!cached) {
      setState((s) => ({ ...s, loading: true, error: null }));
    }

    apiFetch<T>(path)
      .then((data) => {
        if (!alive) return;
        memoryCache.set(path, { data, timestamp: Date.now() });
        setUpdatedAt(new Date());
        setState({ data, loading: false, error: null });
      })
      .catch((error: ApiError) => {
        if (!alive) return;
        setState((s) => ({ ...s, loading: false, error }));
      });

    return () => {
      alive = false;
    };
  }, [path, tick, ttl, skipCache]);

  // Pembaruan senyap berkala (real-time): tanpa layar loading, data lama tetap tampil sampai data baru tiba.
  // Berhenti saat tab tidak terlihat dan langsung menyegarkan saat tab kembali aktif.
  useEffect(() => {
    if (!path || !refreshMs) return;
    let alive = true;
    let busy = false;
    const refresh = () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      apiFetch<T>(path)
        .then((data) => {
          if (!alive) return;
          memoryCache.set(path, { data, timestamp: Date.now() });
          setUpdatedAt(new Date());
          // Data sama dengan sebelumnya: jangan render ulang halaman.
          setState((prev) => (prev.data !== null && JSON.stringify(prev.data) === JSON.stringify(data) ? prev : { data, loading: false, error: null }));
        })
        .catch(() => {
          /* gagal sesaat: biarkan data terakhir tetap tampil */
        })
        .finally(() => {
          busy = false;
        });
    };
    const timer = window.setInterval(refresh, refreshMs);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [path, refreshMs]);

  const reload = useCallback(() => {
    memoryCache.delete(path);
    setTick((t) => t + 1);
  }, [path]);

  return { ...state, reload, updatedAt };
}

export function useRequireSession() {
  const router = useRouter();
  const { data, loading, error, reload } = useApi<{ nim: string; auth_type?: string }>(
    "/v1/auth/me"
  );

  useEffect(() => {
    // Hanya redirect ke login jika request sudah SELESAI (bukan sedang loading)
    // dan backend secara eksplisit mengembalikan 401 Unauthorized / 403 Forbidden.
    if (!loading && error && (error.status === 401 || error.status === 403)) {
      clearApiCache();
      if (typeof window !== "undefined") {
        localStorage.removeItem("ubsi_session_token");
      }
      router.replace("/login");
    }
  }, [loading, error, router]);

  return {
    nim: data?.nim ?? null,
    authType: data?.auth_type ?? null,
    checking: loading,
    authed: !loading && !error,
    error,
    reload,
  };
}
