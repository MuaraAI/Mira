/** Data profil SIAKAD: `program_studi` sudah berisi nama kampus dan `lokasi_cabang` hanya kode angka. */
export interface ProfileLike {
  program_studi?: string;
  lokasi_cabang?: string;
}

/** "Informatika Kampus Kota Pontianak" -> { prodi: "Informatika", kampus: "Kampus Kota Pontianak" } */
export function splitProgram(profile?: ProfileLike | null): { prodi: string; kampus: string } {
  const raw = (profile?.program_studi ?? "").replace(/\s+/g, " ").trim();
  const cabang = (profile?.lokasi_cabang ?? "").trim();
  const idx = raw.search(/\s(Kampus|Kota|Kab\.?|Kabupaten)\s/i);
  if (idx > 0) return { prodi: raw.slice(0, idx).trim(), kampus: raw.slice(idx).trim() };
  // Kode cabang angka ("30") bukan nama kampus, jadi tidak ditampilkan sebagai kampus.
  return { prodi: raw, kampus: cabang && !/^\d+$/.test(cabang) ? cabang : "" };
}
