import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { HowToUse } from "@/components/HowToUse";
import { StatsSection } from "@/components/StatsSection";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { getRepositoryStars } from "@/lib/github";

export default async function Home() {
  const stars = await getRepositoryStars();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-accent/25 selection:text-foreground">
      <Navbar starsCount={stars} />
      <main id="main-content" className="flex-1">
        <Hero />
        <HowToUse />
        <StatsSection />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
