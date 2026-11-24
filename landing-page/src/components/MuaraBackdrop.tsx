import Image from "next/image";

/**
 * Latar belakang halus bertema Muara AI: gradasi samudra lembut di bagian atas kanvas
 * dan garis kontur muara yang tetap menjaga kontras baca pada mode terang.
 */
export function MuaraBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      <div
        className="absolute inset-x-0 top-0 h-[56vh] min-h-[380px] opacity-[0.11]"
        style={{
          maskImage:
            "linear-gradient(to bottom, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.35) 45%, transparent 85%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.35) 45%, transparent 85%)",
        }}
      >
        <Image
          src="/images/hero-ocean-muara.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-top"
          aria-hidden="true"
        />
      </div>

      <svg
        className="absolute inset-0 h-full w-full opacity-[0.07]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M-40,220 C260,150 560,290 880,210 C1160,140 1320,240 1480,190"
          fill="none"
          stroke="#0369A1"
          strokeWidth="1.2"
        />
        <path
          d="M-40,460 C320,390 620,540 960,440 C1200,370 1350,470 1480,430"
          fill="none"
          stroke="#5FA3CC"
          strokeWidth="1"
        />
        <path
          d="M-40,720 C280,650 640,790 980,690 C1220,620 1360,720 1480,680"
          fill="none"
          stroke="#0369A1"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
