import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { TopProgressBar } from "@/components/TopProgressBar";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_TITLE, SITE_URL, GITHUB_URL } from "@/lib/site";
import "./globals.css";

const spaceGrotesk = localFont({
  src: [
    {
      path: "../../public/fonts/SpaceGrotesk-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/SpaceGrotesk-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/SpaceGrotesk-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = localFont({
  src: [
    {
      path: "../../public/fonts/Inter-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Inter-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/Inter-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/Inter-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: [
    {
      path: "../../public/fonts/JetBrainsMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/JetBrainsMono-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/JetBrainsMono-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Pixelify Sans (OFL-1.1): pixel display face shared with muaraai.com, used for dashboard headings.
const pixelify = localFont({
  src: [
    {
      path: "../../public/fonts/pixelify-sans-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/pixelify-sans-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/pixelify-sans-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-pixel",
  display: "swap",
  // Hanya huruf. Angka dan simbol memakai Space Grotesk karena di Pixelify "2" dan "Z" bentuknya sama.
  declarations: [{ prop: "unicode-range", value: "U+0041-005A, U+0061-007A" }],
});

const aestetico = localFont({
  src: [
    {
      path: "../../public/fonts/Aestetico-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Aestetico-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/Aestetico-SemiBold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/Aestetico-Bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-aestetico",
  display: "swap",
  adjustFontFallback: false,
  // Versi trial Aestetico mengganti tanda hubung & sebagian angka dengan glif "DEMO"; batasi ke huruf Latin, spasi, koma, titik.
  declarations: [{ prop: "unicode-range", value: "U+0020, U+002C, U+002E, U+0041-005A, U+0061-007A" }],
});

const grosen = localFont({
  src: [
    {
      path: "../../public/fonts/Grosen-Medium.otf",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-grosen",
  display: "swap",
  adjustFontFallback: false,
  // Fontspring DEMO Grosen mengganti angka 4 dan sebagian simbol dengan glif DEMO; batasi ke huruf Latin + tanda baca bersih.
  declarations: [
    {
      prop: "unicode-range",
      value: "U+0020, U+002C, U+002E, U+003A-003B, U+003F, U+0041-005A, U+0061-007A",
    },
  ],
});

export const viewport: Viewport = {
  themeColor: "#0369A1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Keyboard virtual mengecilkan layout (bukan menimpa), seperti aplikasi native: input chat & pencarian tetap terlihat.
  interactiveWidget: "resizes-content",
};

const SEARCH_TITLE_KEYWORDS = [
  "Mira UBSI",
  "Mira Mahasiswa",
  "UBSI-API",
  "dashboard mahasiswa UBSI",
  "jadwal kuliah UBSI",
  "nilai KHS UBSI",
  "tugas MyBest UBSI",
  "presensi MyBest",
  "Universitas Bina Sarana Informatika",
  "BSI SIAKAD",
  "Elearning MyBest UBSI",
  "Muara AI",
];

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  referrer: "strict-origin-when-cross-origin",
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    title: "Mira",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icon.png",
    apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180" }],
  },
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: SEARCH_TITLE_KEYWORDS,
  authors: [
    { name: "Yuken Velino", url: "https://github.com/Curzyori" },
    { name: "Verzio Yamanansyah", url: "https://github.com/MyKineID" },
    { name: "Muhammad Raffli Aldiansyah", url: "https://github.com/Seeyaa77" },
    { name: "Muara AI", url: "https://github.com/MuaraAI" },
  ],
  creator: "Muara AI",
  publisher: "Muara AI",
  category: "education",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
    types: { "text/markdown": "/llms.txt" },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME}: ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@MuaraAI",
    creator: "@MuaraAI",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgId = `${SITE_URL}/#organization`;
  const siteId = `${SITE_URL}/#website`;
  const appId = `${SITE_URL}/#software`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "Muara AI",
        url: "https://muaraai.com",
        sameAs: [
          "https://github.com/MuaraAI",
          "https://x.com/MuaraAI",
          "https://www.instagram.com/muara.ai/",
          "https://www.threads.net/@muara.ai",
        ],
      },
      {
        "@type": "WebSite",
        "@id": siteId,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: ["Mira UBSI", "UBSI API", "UBSI-API", "UBSI API Muara"],
        description: SITE_DESCRIPTION,
        inLanguage: "id-ID",
        publisher: { "@id": orgId },
      },
      {
        "@type": ["WebApplication", "EducationalApplication"],
        "@id": appId,
        name: SITE_NAME,
        alternateName: ["UBSI API", "UBSI-API"],
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web, Android, iOS (PWA)",
        softwareVersion: "4.0.0",
        screenshot: `${SITE_URL}/opengraph-image`,
        inLanguage: "id-ID",
        isAccessibleForFree: true,
        license: `${GITHUB_URL}/blob/main/LICENSE`,
        codeRepository: GITHUB_URL,
        featureList: [
          "Dashboard akademik UBSI: jadwal, tugas, presensi, materi, kuis, nilai KHS, KRS, kartu ujian",
          "Notifikasi push PWA",
        ],
        offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
        author: [
          { "@type": "Person", name: "Yuken Velino", url: "https://github.com/Curzyori" },
          { "@type": "Person", name: "Verzio Yamanansyah", url: "https://github.com/MyKineID" },
          { "@type": "Person", name: "Muhammad Raffli Aldiansyah", url: "https://github.com/Seeyaa77" },
        ],
        publisher: { "@id": orgId },
      },
    ],
  };
  return (
    <html
      lang="id"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${pixelify.variable} ${aestetico.variable} ${grosen.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-background text-foreground antialiased min-h-screen font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:font-semibold focus:shadow-float focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0369A1]"
        >
          Langsung ke konten utama
        </a>
        <TopProgressBar />
        {children}
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  );
}
