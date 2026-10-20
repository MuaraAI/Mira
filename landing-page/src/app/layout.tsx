import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
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
});

export const viewport: Viewport = {
  themeColor: "#0369A1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "UBSI API",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icon.png",
    apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180" }],
  },
  title: "UBSI API v2: Dashboard Akademik, REST API, dan MCP UBSI | Muara AI",
  description:
    "Dashboard akademik dan REST API untuk jadwal, tugas, presensi, materi, nilai, layanan kampus, serta integrasi MCP UBSI.",
  keywords: [
    "UBSI API",
    "SIAKAD UBSI API",
    "Elearning MyBest UBSI",
    "Ejournal UBSI",
    "Muara AI",
    "API Kampus UBSI",
    "Yuken Velino",
    "Verzio",
  ],
  metadataBase: new URL("https://ubsi-api.muaraai.com"),
  alternates: {
    canonical: "https://ubsi-api.muaraai.com",
  },
  openGraph: {
    title: "UBSI API v2: Dashboard Akademik, REST API, dan MCP UBSI",
    description:
      "Akses layanan akademik UBSI melalui dashboard, REST API, dan MCP dengan autentikasi per pengguna.",
    url: "https://ubsi-api.muaraai.com",
    siteName: "UBSI API: Muara AI",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "UBSI API v2: Dashboard Akademik, REST API, dan MCP UBSI",
    description:
      "Akses layanan akademik UBSI melalui dashboard, REST API, dan MCP dengan autentikasi per pengguna.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["SoftwareApplication", "WebAPI"],
    name: "UBSI API",
    applicationCategory: "DeveloperApplication, EducationalApplication",
    operatingSystem: "Cloud, Docker, Linux",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "IDR",
    },
    author: [
      {
        "@type": "Person",
        name: "Yuken Velino",
        url: "https://github.com/Curzyori",
      },
      {
        "@type": "Person",
        name: "Verzio",
        url: "https://github.com/MyKineID",
      },
    ],
    publisher: {
      "@type": "Organization",
      name: "Muara AI",
      url: "https://github.com/MuaraAI",
    },
  };

  return (
    <html
      lang="id"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${pixelify.variable}`}
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
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:font-semibold focus:shadow-float focus:outline-none"
        >
          Langsung ke konten utama
        </a>
        {children}
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  );
}
