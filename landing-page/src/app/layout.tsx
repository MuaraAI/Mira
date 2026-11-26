import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { TopProgressBar } from "@/components/TopProgressBar";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_TITLE, SITE_URL } from "@/lib/site";
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
  preload: true,
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
  preload: false,
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
  preload: false,
});

export const viewport: Viewport = {
  themeColor: "#0369A1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Keyboard virtual mengecilkan layout (bukan menimpa), seperti aplikasi native: input chat & pencarian tetap terlihat.
  interactiveWidget: "resizes-content",
};

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
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "Muara AI",
        url: "https://muaraai.com",
        email: "admin@muaraai.com",
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon.png`,
        },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "technical support",
          email: "admin@muaraai.com",
          availableLanguage: ["Indonesian", "English"],
        },
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
        alternateName: [
          "Mira UBSI",
          "Mira BSI",
          "Mira Muara AI",
          "Mira MuaraAI",
          "Mira API",
          "UBSI API",
          "UBSI-API",
          "BSI API",
        ],
        description: SITE_DESCRIPTION,
        inLanguage: "id-ID",
        publisher: { "@id": orgId },
      },
    ],
  };
  return (
    <html
      lang="id"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
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
