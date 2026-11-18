"use client";

import { PageHeader } from "@/components/dashboard-ui";
import { SiaKadLockedCard } from "@/components/SiaKadLockedCard";

export default function KrsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Kartu Rencana Studi (KRS)"
        description="KRS berisi mata kuliah yang kamu ambil semester ini, kelompok ruang ujian, dan lembar kartu ujian fisik resmi."
      />
      <SiaKadLockedCard
        title="KRS ada di SIAKAD"
        description="Mira tidak lagi mengambil data KRS. Buka students.bsi.ac.id untuk melihat daftar mata kuliah aktif, total SKS semester, dan mencetak kartu ujian."
      />
    </div>
  );
}
