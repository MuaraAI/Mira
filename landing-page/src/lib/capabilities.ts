"use client";

import { useApi } from "@/lib/api";

/** Status fitur kampus dari `/v1/capabilities`. */
export interface Capabilities {
  siakad: {
    enabled: boolean;
    cta_url: string;
  };
}

export const SIAKAD_CTA_FALLBACK = "https://students.bsi.ac.id";

export function useCapabilities() {
  const { data, loading, error } = useApi<Capabilities>("/v1/capabilities", {
    persistMs: 60_000,
  });
  return { data, loading, error };
}

export function siakadCtaUrl(capabilities: Capabilities | null): string {
  return capabilities?.siakad.cta_url || SIAKAD_CTA_FALLBACK;
}
