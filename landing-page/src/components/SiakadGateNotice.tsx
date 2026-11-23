"use client";

import Link from "next/link";
import { ShieldAlert, ShieldX } from "lucide-react";
import { ApiError } from "@/lib/api";

/** Kenali dua penolakan gerbang perangkat pada jalur SIAKAD. */
export function siakadGateIssue(error: unknown): "device_pending" | "relink" | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "SIAKAD_DEVICE_PENDING") return "device_pending";
  if (error.code === "SIAKAD_RELINK_REQUIRED") return "relink";
  return null;
}

/** Kartu penjelasan saat SIAKAD terkunci karena perangkat atau tautan bermasalah. */
export function SiakadGateNotice({ kind }: { kind: "device_pending" | "relink" }) {
  const isPending = kind === "device_pending";
  return (
    <div className="glass-card space-y-3 border-l-4 border-l-[#92400E] p-6">
      <div className="flex items-start gap-3">
        {isPending ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 text-[#92400E]" aria-hidden="true" />
        ) : (
          <ShieldX className="mt-0.5 h-5 w-5 text-[#B91C1C]" aria-hidden="true" />
        )}
        <div className="space-y-1">
          <h2 className="text-base font-display font-bold text-foreground">
            {isPending ? "Perangkat ini belum diizinkan" : "Password SIAKAD berubah di portal kampus"}
          </h2>
          <p className="text-sm text-secondary">
            {isPending
              ? "Data SIAKAD terkunci di perangkat ini. Fitur MyBest tetap bisa dipakai. Izinkan perangkat dari perangkat tepercaya di halaman Sesi & Keamanan."
              : "Tautan SIAKAD tersimpan sudah tidak diterima kampus. Tautkan ulang sekali di halaman Sesi & Keamanan supaya data SIAKAD bisa dibuka lagi."}
          </p>
        </div>
      </div>
      <Link className="inline-flex text-sm font-semibold text-[#0369A1] underline" href="/dashboard/sesi">
        Buka Sesi & Keamanan
      </Link>
    </div>
  );
}
