import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * Font self-hosted yang sama dengan Mira (landing-page/public/fonts), plus Jersey 25 untuk subtitle.
 * Pixelify Sans hanya untuk huruf (A-Z, a-z) persis seperti layout.tsx Mira:
 * angka dan simbol jatuh ke Space Grotesk.
 */
const FONTS: { family: string; file: string; weight: string; unicodeRange?: string }[] = [
  { family: "Inter", file: "Inter-Regular.woff2", weight: "400" },
  { family: "Inter", file: "Inter-Medium.woff2", weight: "500" },
  { family: "Inter", file: "Inter-SemiBold.woff2", weight: "600" },
  { family: "Inter", file: "Inter-Bold.woff2", weight: "700" },
  { family: "Space Grotesk", file: "SpaceGrotesk-Regular.woff2", weight: "400" },
  { family: "Space Grotesk", file: "SpaceGrotesk-Medium.woff2", weight: "500" },
  { family: "Space Grotesk", file: "SpaceGrotesk-Bold.woff2", weight: "700" },
  { family: "JetBrains Mono", file: "JetBrainsMono-Regular.woff2", weight: "400" },
  { family: "JetBrains Mono", file: "JetBrainsMono-Medium.woff2", weight: "500" },
  { family: "JetBrains Mono", file: "JetBrainsMono-Bold.woff2", weight: "700" },
  { family: "Pixelify Sans", file: "pixelify-sans-latin-500-normal.woff2", weight: "500", unicodeRange: "U+0041-005A, U+0061-007A" },
  { family: "Pixelify Sans", file: "pixelify-sans-latin-600-normal.woff2", weight: "600", unicodeRange: "U+0041-005A, U+0061-007A" },
  { family: "Pixelify Sans", file: "pixelify-sans-latin-700-normal.woff2", weight: "700", unicodeRange: "U+0041-005A, U+0061-007A" },
  // Subtitle: Jersey 25 (pixel, SIL OFL 1.1, lisensi di public/fonts/LICENSE-Jersey25-OFL.txt)
  { family: "Jersey 25", file: "jersey-25-latin-400-normal.woff2", weight: "400" },
];

let started = false;

export function loadMiraFonts() {
  if (started) return;
  started = true;
  for (const font of FONTS) {
    loadFont({
      family: font.family,
      url: staticFile(`fonts/${font.file}`),
      weight: font.weight,
      format: "woff2",
      unicodeRange: font.unicodeRange,
    }).catch((err) => console.error("Gagal memuat font", font.file, err));
  }
}
