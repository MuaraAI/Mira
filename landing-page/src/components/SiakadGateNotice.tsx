"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";
import { ApiError } from "@/lib/api";

/** Kenali penolakan gerbang tautan SIAKAD yang memerlukan tautan ulang. */
export function siakadGateIssue(error: unknown): "relink" | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "SIAKAD_RELINK_REQUIRED") return "relink";
  return null;
}

/** Kartu penjelasan saat tautan SIAKAD bermasalah dan perlu ditautkan ulang. */
export function SiakadGateNotice({ kind: _kind }: { kind: "relink" }) {
  void _kind;
  return (
    <div className="glass-card space-y-3 border-l-4 border-l-[#92400E] p-6">
      <div className="flex items-start gap-3">
        <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-[#B91C1C]" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-base font-display font-bold text-foreground">
            Password SIAKAD berubah di portal kampus
          </h2>
          <p className="text-sm text-secondary">
            Tautan SIAKAD tersimpan sudah tidak diterima kampus. Tautkan ulang sekali di halaman Sesi &amp; Keamanan supaya data SIAKAD bisa dibuka lagi.
          </p>
        </div>
      </div>
      <Link className="inline-flex text-sm font-semibold text-[#0369A1] underline" href="/dashboard/sesi">
        Buka Sesi &amp; Keamanan
      </Link>
    </div>
  );
}
