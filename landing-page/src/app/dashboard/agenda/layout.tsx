import type { Metadata } from "next";

export const metadata: Metadata = { title: "Info Kampus | Mira" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
