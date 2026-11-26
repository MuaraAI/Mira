import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Demo Dashboard Mahasiswa UBSI Interaktif",
  description:
    "Coba simulasi dashboard akademik Mira UBSI tanpa login: pantau jadwal kuliah, presensi kehadiran, tugas, kuis, KHS, dan layanan kampus contoh.",
  path: "/demo",
});

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Beranda", path: "/" },
  { name: "Demo Dashboard", path: "/demo" },
]);

export default function DemoLayout({ children }: { children: React.ReactNode }) {
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
