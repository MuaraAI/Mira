import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo Dashboard Interaktif",
  description:
    "Coba langsung simulasi dashboard akademik Mira UBSI dengan data mock realistis: pantau jadwal kuliah, presensi kehadiran, tugas, kuis, dan nilai tanpa perlu login.",
  alternates: { canonical: "/demo" },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
