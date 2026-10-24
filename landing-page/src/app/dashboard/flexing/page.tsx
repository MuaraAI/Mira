"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/dashboard-ui";

export default function FlexingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/nilai?flexing=1");
  }, [router]);

  return <LoadingState label="Membuka Studio Flexing di halaman Nilai & KHS" />;
}
