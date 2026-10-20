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
    <section id="layanan" className="border-b-2 border-px-soft bg-white" aria-labelledby="student-services-title">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20 lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="section-kicker mb-4">Untuk mahasiswa</p>
          <h2 id="student-services-title" className="max-w-md font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
            Mulai dari pekerjaan kuliah yang nyata.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-secondary">
            Dashboard menyatukan layanan yang biasanya kamu buka terpisah. Login sekali, lalu pilih kebutuhanmu dari alur yang jelas.
          </p>
          <Link href="/login" className="px-btn mt-8 inline-flex min-h-11 items-center gap-2 px-5 py-3 text-sm font-bold">
            Buka Dashboard
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="grid gap-6 p-[2px]">
          {serviceGroups.map((group, index) => (
            <div key={group.id} className="px-card px-card-hover grid gap-5 bg-white p-5 sm:grid-cols-[0.75fr_1.25fr] sm:gap-8 sm:p-6">
              <div className="min-w-0">
                <span className="px-icon mb-4 h-9 w-9 font-mono text-xs font-bold" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-xl font-semibold text-foreground">{group.title}</h3>
                <p className="mt-1 text-sm leading-6 text-secondary">{group.description}</p>
              </div>
              <div className="grid content-start gap-3 min-[420px]:grid-cols-2">
                {group.links.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="group/link flex min-h-11 items-center justify-between gap-2 bg-surface-alt px-3.5 text-sm font-medium text-foreground shadow-[0_-2px_0_0_#D9E5ED,0_2px_0_0_#D9E5ED,-2px_0_0_0_#D9E5ED,2px_0_0_0_#D9E5ED] transition-[background-color,color,box-shadow,transform] duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-white hover:text-[#075985] hover:shadow-[0_-2px_0_0_#0369A1,0_2px_0_0_#0369A1,-2px_0_0_0_#0369A1,2px_0_0_0_#0369A1,4px_4px_0_0_#9CC6E0]"
                  >
                    <span>{label}</span>
                    <span className="font-mono text-xs text-px-water-mid transition-transform duration-200 group-hover/link:translate-x-0.5 group-hover/link:text-[#0369A1]" aria-hidden="true">→</span>
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
