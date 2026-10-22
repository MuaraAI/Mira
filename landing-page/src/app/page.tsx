import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { DeveloperSection } from "@/components/DeveloperSection";
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
        <DeveloperSection />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
