import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Login Mahasiswa UBSI",
  description:
    "Masuk ke dashboard Mira UBSI dengan NIM dan password MyBest. Pantau jadwal kuliah, tugas, presensi, bahan ajar, KHS, dan nilai dalam satu tempat.",
  path: "/login",
});

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Beranda", path: "/" },
  { name: "Login Mahasiswa", path: "/login" },
]);

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
