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
  options?: { ttlMs?: number; skipCache?: boolean }
) {
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  const skipCache = options?.skipCache ?? false;

  const [state, setState] = useState<ApiState<T>>(() => {
    if (!skipCache && typeof window !== "undefined") {
      const cached = memoryCache.get(path) as CacheEntry<T> | undefined;
      if (cached && Date.now() - cached.timestamp < ttl) {
        return { data: cached.data, loading: false, error: null };
      }
    }
    return { data: null, loading: true, error: null };
  });

  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;

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

  const reload = useCallback(() => {
    memoryCache.delete(path);
    setTick((t) => t + 1);
  }, [path]);

  return { ...state, reload };
}

export function useRequireSession() {
  const router = useRouter();
  const { data, loading, error, reload } = useApi<{ nim: string; auth_type?: string }>(
    "/v1/auth/me"
  );

  useEffect(() => {
    if (error && (error.status === 401 || error.status === 403)) {
      // Hapus cache RAM agar data user lama tidak bocor ke login berikutnya
      clearApiCache();
      router.replace("/login");
    }
  }, [error, router]);

  return {
    nim: data?.nim ?? null,
    authType: data?.auth_type ?? null,
    checking: loading,
    authed: !loading && !error,
    error,
    reload,
  };
}
