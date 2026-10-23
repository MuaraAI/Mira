import Image from "next/image";

export function Monogram({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <Image
      src="/logo/logo.png"
      alt="Logo Mira"
      width={36}
      height={36}
      className={`${className} object-contain`}
      priority
    />
  );
}
