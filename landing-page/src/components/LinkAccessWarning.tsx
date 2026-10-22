import { AlertTriangle } from "lucide-react";
import type { LinkCheck } from "@/lib/links";

/** Peringatan merah saat link tidak bisa dibuka orang lain, lengkap dengan langkah memperbaikinya. */
export function LinkAccessWarning({ check, provider }: { check: LinkCheck | null; provider: string | null }) {
  if (!check || (check.access !== "private" && check.access !== "missing")) return null;
  const google = provider === "google_drive" || provider === "google_docs";
  return (
    <div className="bg-[#FFF1F2] p-3 text-xs leading-relaxed text-[#9F1239] shadow-[0_-2px_0_0_#FDA4AF,0_2px_0_0_#FDA4AF,-2px_0_0_0_#FDA4AF,2px_0_0_0_#FDA4AF]" role="alert">
      <p className="flex items-center gap-1.5 font-bold">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {check.access === "missing" ? "Link tidak ditemukan" : "Dosen belum bisa membuka link ini"}
      </p>
      <p className="mt-1">{check.message}</p>
      {google && check.access === "private" && (
        <ol className="mt-2 list-decimal space-y-0.5 pl-5">
          <li>Buka berkasnya di Google Drive, klik <strong>Bagikan</strong>.</li>
          <li>Di bagian Akses umum pilih <strong>Siapa saja yang memiliki link</strong>.</li>
          <li>Pastikan perannya <strong>Pelihat (Viewer)</strong>, lalu klik <strong>Selesai</strong> dan tekan Cek ulang.</li>
        </ol>
      )}
    </div>
  );
}
