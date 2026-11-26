import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/site";
import { AuthPortal } from "../login/AuthPortal";

export const metadata = buildPageMetadata({
  title: "Lupa Password MyBest & SIAKAD UBSI",
  description:
    "Minta link reset password akun MyBest atau SIAKAD UBSI langsung ke email kampus terdaftar. Cukup masukkan NIM dan email aktif tanpa ribet.",
  path: "/lupa-password",
});

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Beranda", path: "/" },
  { name: "Lupa Password", path: "/lupa-password" },
]);

export default function LupaPasswordPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <AuthPortal initialView="forgot" />
    </>
  );
}
