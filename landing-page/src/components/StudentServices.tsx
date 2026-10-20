import Link from "next/link";

const serviceGroups = [
  {
    id: "perkuliahan",
    title: "Perkuliahan",
    description: "Hal yang paling sering kamu cek sebelum dan sesudah kelas.",
    links: [
      ["Jadwal kuliah", "/dashboard/jadwal"],
      ["Bahan ajar", "/dashboard/materi"],
      ["Tugas kuliah", "/dashboard/tugas"],
      ["Presensi", "/dashboard/presensi"],
    ],
  },
  {
    id: "akademik",
    title: "Akademik",
    description: "Ringkasan hasil studi dan kebutuhan administrasi semester.",
    links: [
      ["Nilai dan KHS", "/dashboard/nilai"],
      ["Kartu KRS", "/dashboard/krs"],
      ["Kartu ujian", "/dashboard/ujian"],
    ],
  },
  {
    id: "kampus",
    title: "Layanan kampus",
    description: "Cari informasi kampus dan koleksi perpustakaan dari satu dashboard.",
    links: [
      ["Berita kampus", "/dashboard/berita"],
      ["Perpustakaan", "/dashboard/perpustakaan"],
    ],
  },
];

export function StudentServices() {
  return (
    <section id="layanan" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="student-services-title">
      <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
        <div>
          <p className="section-kicker mb-4">Untuk mahasiswa</p>
          <h2 id="student-services-title" className="max-w-md font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
            Mulai dari pekerjaan kuliah yang nyata.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-secondary">
            Dashboard menyatukan layanan yang biasanya kamu buka terpisah. Login sekali, lalu pilih kebutuhanmu dari alur yang jelas.
          </p>
          <Link href="/login" className="mt-7 inline-flex min-h-11 items-center rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3B5A70]">
            Buka Dashboard
          </Link>
        </div>

        <div className="divide-y divide-stroke border-y border-stroke">
          {serviceGroups.map((group) => (
            <div key={group.id} className="grid gap-4 py-6 sm:grid-cols-[0.75fr_1.25fr] sm:gap-8">
              <div>
                <h3 className="font-display text-xl font-semibold text-foreground">{group.title}</h3>
                <p className="mt-1 text-sm leading-6 text-secondary">{group.description}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.links.map(([label, href]) => (
                  <Link key={href} href={href} className="flex min-h-11 items-center justify-between rounded-lg border border-stroke bg-white px-3.5 text-sm font-medium text-foreground transition-colors hover:border-[#0369A1] hover:text-[#075985]">
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
