import type { Metadata } from "next";
import { AuthPortal } from "../login/AuthPortal";

export const metadata: Metadata = {
  title: "Lupa Password",
  description: "Minta link reset password SIAKAD atau MyBest UBSI dengan NIM dan email terdaftar.",
  alternates: { canonical: "/lupa-password" },
};

export default function LupaPasswordPage() {
  return <AuthPortal initialView="forgot" />;
}
