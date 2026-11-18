"use client";

import { useApi } from "@/lib/api";

/** Status maintenance publik dari `/v1/maintenance`. */
export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  reason: string;
}

export function useMaintenance() {
  const { data, loading } = useApi<MaintenanceStatus>("/v1/maintenance", {
    persistMs: 60_000,
  });
  return { status: data ?? null, loading };
}
