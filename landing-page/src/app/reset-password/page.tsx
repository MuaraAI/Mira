import type { Metadata } from "next";
import { AuthPortal } from "../login/AuthPortal";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Setel password baru SIAKAD atau MyBest UBSI memakai link reset dari email.",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return <AuthPortal initialView="reset" />;
}
