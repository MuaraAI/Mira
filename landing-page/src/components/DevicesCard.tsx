"use client";

import { useState } from "react";
import { Laptop, ShieldCheck, ShieldX, Clock3 } from "lucide-react";
import { apiFetch, ApiError, useApi } from "@/lib/api";
import { ghostButtonClass } from "@/components/dashboard-ui";

/** Bentuk data `GET /v1/auth/devices`. */
export interface DeviceEntry {
  handle: string;
  label: string;
  user_agent?: string | null;
  status: "trusted" | "pending" | "revoked";
  last_seen?: string | null;
  is_current?: boolean;
}

interface DevicesResponse {
  devices: DeviceEntry[];
  total: number;
}

const STATUS_COPY: Record<DeviceEntry["status"], { text: string; className: string }> = {
  trusted: { text: "Tepercaya", className: "bg-[#F0F7FB] text-[#0F766E] border-[#0F766E]/20" },
  pending: { text: "Menunggu izin", className: "bg-[#FFF8E6] text-[#92400E] border-[#92400E]/20" },
  revoked: { text: "Dicabut", className: "bg-[#FEF2F2] text-[#B91C1C] border-[#B91C1C]/20" },
};

function formatSeen(value?: string | null) {
  if (!value) return "belum tercatat";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

/** Daftar perangkat akun: izinkan perangkat baru atau cabut izinnya. */
export function DevicesCard() {
  const { data, loading, error, reload } = useApi<DevicesResponse>("/v1/auth/devices");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function mutate(device: DeviceEntry, action: "approve" | "revoke") {
    setBusy(device.handle);
    setNotice(null);
    try {
      if (action === "approve") {
        await apiFetch(`/v1/auth/devices/${device.handle}/approve`, { method: "POST" });
        setNotice(`Perangkat ${device.label} diizinkan.`);
      } else {
        const result = await apiFetch<{ sessions_ended?: number }>(
          `/v1/auth/devices/${device.handle}`,
          { method: "DELETE" }
        );
        setNotice(
          `Izin ${device.label} dicabut${result?.sessions_ended ? `, ${result.sessions_ended} sesi diakhiri` : ""}.`
        );
      }
      reload();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Aksi perangkat gagal. Coba lagi dari perangkat tepercaya.";
      setNotice(message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="glass-card p-6 space-y-4" aria-labelledby="devices-title">
      <header className="space-y-1">
        <h2 id="devices-title" className="text-lg font-display font-bold text-foreground">
          Perangkat
        </h2>
        <p className="text-sm text-secondary">
          Perangkat tepercaya bisa memakai SIAKAD yang sudah tertaut. Perangkat baru tetap bisa
          memakai fitur MyBest sampai diizinkan di sini.
        </p>
      </header>

      {loading && !data ? (
        <p className="text-sm text-secondary">Memuat daftar perangkat...</p>
      ) : error ? (
        <p className="text-sm text-[#B91C1C]">{error.message}</p>
      ) : (
        <ul className="space-y-3">
          {(data?.devices ?? []).map((device) => {
            const chip = STATUS_COPY[device.status];
            return (
              <li
                key={device.handle}
                className="flex flex-col gap-3 rounded-xl border border-stroke bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <Laptop className="mt-0.5 h-4 w-4 text-secondary" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {device.label}
                      {device.is_current && (
                        <span className="ml-2 text-[11px] font-mono uppercase text-secondary">
                          perangkat ini
                        </span>
                      )}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-secondary">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                      Terakhir aktif {formatSeen(device.last_seen)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[11px] font-bold ${chip.className}`}
                  >
                    {device.status === "trusted" ? (
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <ShieldX className="h-3 w-3" aria-hidden="true" />
                    )}
                    {chip.text}
                  </span>

                  {device.status === "pending" && (
                    <button
                      type="button"
                      className={ghostButtonClass}
                      disabled={busy === device.handle}
                      onClick={() => mutate(device, "approve")}
                    >
                      Izinkan
                    </button>
                  )}
                  {device.status !== "revoked" && (
                    <button
                      type="button"
                      className={ghostButtonClass}
                      disabled={busy === device.handle}
                      onClick={() => mutate(device, "revoke")}
                    >
                      Cabut
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {notice && <p className="text-xs text-secondary">{notice}</p>}
    </section>
  );
}
