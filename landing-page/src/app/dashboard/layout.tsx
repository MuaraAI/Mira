import type { Metadata } from "next";
import localFont from "next/font/local";
import DashboardShell from "./DashboardShell";

// Pixelify Sans (OFL-1.1): hanya dimuat di /dashboard agar homepage dan halaman publik bebas preload tambahan.
const pixelify = localFont({
  src: [
    {
      path: "../../../public/fonts/pixelify-sans-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../public/fonts/pixelify-sans-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../../public/fonts/pixelify-sans-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-pixel",
  display: "swap",
  preload: false,
  // Hanya huruf. Angka dan simbol memakai Space Grotesk karena di Pixelify "2" dan "Z" bentuknya sama.
  declarations: [{ prop: "unicode-range", value: "U+0041-005A, U+0061-007A" }],
});

// Dashboard berisi data pribadi mahasiswa: tidak untuk diindeks. Tiap halaman menimpa judul lewat layout.tsx-nya sendiri.
export const metadata: Metadata = {
  title: "Ringkasan",
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={pixelify.variable}>
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
