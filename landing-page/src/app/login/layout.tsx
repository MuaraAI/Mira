import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login Mahasiswa",
  description:
    "Masuk ke dashboard Mira dengan NIM dan password SIAKAD serta MyBest. Lihat jadwal kuliah, tugas, presensi, materi, dan nilai UBSI dalam satu tempat.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
