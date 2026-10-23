import type { Metadata } from "next";

export const metadata: Metadata = { title: "Forum Diskusi | Mira" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
