import type { Metadata } from "next";
import { AuthPortal } from "../../login/AuthPortal";

export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
};

/** Versi Mira dari link kampus: /reset-password/<token>?email=...&sys=mybest|siakad. URL dibersihkan setelah dibuka. */
export default async function ResetTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ email?: string; sys?: string }>;
}) {
  const { token } = await params;
  const { email, sys } = await searchParams;
  const valid = /^[A-Za-z0-9]{20,128}$/.test(token);
  return (
    <AuthPortal
      initialView="reset"
      initialReset={
        valid
          ? {
              token,
              email: (email ?? "").trim().toLowerCase(),
              system: sys === "siakad" || sys === "mybest" ? sys : null,
            }
          : null
      }
    />
  );
}
