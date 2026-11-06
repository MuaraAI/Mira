import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo Dashboard Interaktif | Mira",
  description:
    "Simulasi dashboard akademik interaktif Mira UBSI tanpa perlu login dan tanpa API: pantau jadwal kuliah, presensi kehadiran, tugas, kuis, dan nilai dengan data contoh.",
  alternates: { canonical: "/demo" },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
