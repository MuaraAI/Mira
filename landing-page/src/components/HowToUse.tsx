import Image from "next/image";

const STEPS = [
  {
    mascot: "/maskot/mura-presensi.png",
    title: "Login pakai akun kampus",
    text: "Masuk dengan NIM dan password SIAKAD/MyBest kamu. Nggak perlu daftar baru, gak perlu verifikasi aneh-aneh.",
  },
  {
    mascot: "/maskot/mura-tugas-done.png",
    title: "Semuanya langsung kebuka",
    text: "Jadwal, absen, tugas, ujian, sampai nilai, tampil rapi di satu dashboard. Kumpulin tugas langsung dari HP.",
  },
  {
    mascot: "/maskot/mura-offline.png",
    title: "Pasang di HP biar ada pengingat",
    text: "Tekan Download App, izinkan notifikasi, dan Mura bakal ingetin pas ada kelas mulai, absen dibuka, atau tugas mau deadline.",
  },
];

/**
 * Section "Cara Pakai": 3 langkah ramah mahasiswa awam.
 * Menggantikan DeveloperSection (konten dev dipindah ke footer/API docs).
 */
export function HowToUse() {
  return (
    <section id="cara-pakai" className="border-b-2 border-px-soft bg-white scroll-mt-28" aria-labelledby="cara-pakai-title">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <h2 id="cara-pakai-title" className="font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
          Cara pakainya gampang banget
        </h2>
        <p className="mt-4 max-w-lg text-base leading-7 text-secondary">
          Cuma butuh akun kampus yang udah kamu punya. Tiga langkah, langsung jalan.
        </p>

        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map(({ mascot, title, text }, index) => (
            <li key={title} className="px-card flex min-w-0 flex-col items-start bg-white p-5 sm:p-6">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#0369A1]">
                Langkah {index + 1}
              </span>
              <Image
                src={mascot}
                alt=""
                width={120}
                height={120}
                className="mx-auto my-4 h-28 w-28 object-contain"
                aria-hidden="true"
              />
              <h3 className="text-base font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-secondary">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
