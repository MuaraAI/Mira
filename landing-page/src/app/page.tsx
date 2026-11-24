import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { HowToUse } from "@/components/HowToUse";
import { StatsSection } from "@/components/StatsSection";
import { SupportSection } from "@/components/SupportSection";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { getRepositoryContributors, getRepositoryStats } from "@/lib/github";

export default async function Home() {
  const [repoStats, contributors] = await Promise.all([
    getRepositoryStats(),
    getRepositoryContributors(),
  ]);

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
    </div>
  );
}
