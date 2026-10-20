import type { Metadata } from "next";
import DashboardShell from "./DashboardShell";

// Dashboard berisi data pribadi mahasiswa: tidak untuk diindeks. Tiap halaman menimpa judul lewat layout.tsx-nya sendiri.
export const metadata: Metadata = {
  title: "Ringkasan",
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
