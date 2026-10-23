import type { Metadata } from "next";

export const metadata: Metadata = { title: "Perpustakaan OPAC | Mira" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
