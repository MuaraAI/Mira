import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { HowToUse } from "@/components/HowToUse";
import { StatsSection } from "@/components/StatsSection";
import { SupportSection } from "@/components/SupportSection";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { getRepositoryContributors, getRepositoryStats } from "@/lib/github";
import { GITHUB_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [repoStats, contributors] = await Promise.all([
    getRepositoryStats(),
    getRepositoryContributors(),
  ]);

  const webApplicationJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    alternateName: ["Mira UBSI", "UBSI API", "UBSI-API"],
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
      "Agregasi 6 layanan portal kampus UBSI: SIAKAD, MyBest, Ujian Online, Perpustakaan OPAC, Berita Kampus, dan Repository",
      "Pantau jadwal kuliah, presensi mandiri, tugas, bahan ajar, kuis CBT, KHS, KRS, dan kartu ujian dalam satu dashboard",
      "REST API publik berbasis Personal API Key untuk otomasi dan bot mahasiswa",
      "Server Model Context Protocol (MCP) dengan 42 tools mira_* untuk AI agent",
      "Notifikasi pengingat melalui PWA Web Push, Discord, Telegram, serta ruang Komunitas mahasiswa",
    ],
    offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
    author: [
      { "@type": "Person", name: "Yuken Velino", url: "https://github.com/Curzyori" },
      { "@type": "Person", name: "Verzio Yamanansyah", url: "https://github.com/MyKineID" },
      { "@type": "Person", name: "Muhammad Raffli Aldiansyah", url: "https://github.com/Seeyaa77" },
    ],
    publisher: { "@id": `${SITE_URL}/#organization` },
  };

  return (
    <div className="mira-home flex min-h-screen flex-col bg-background text-foreground selection:bg-accent/20 selection:text-foreground">
      <Navbar starsCount={repoStats?.stars ?? null} />
      <main id="main-content" className="flex-1">
        <Hero />
        <HowToUse contributors={contributors} />
        <StatsSection githubStats={repoStats} />
        <SupportSection />
        <Faq />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationJsonLd) }}
      />
    </div>
  );
}
