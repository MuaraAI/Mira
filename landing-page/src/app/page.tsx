import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { StudentServices } from "@/components/StudentServices";
import { PublicApiSurface } from "@/components/PublicApiSurface";
import { PublicStats } from "@/components/PublicStats";
import { Footer } from "@/components/Footer";
import { getRepositoryStars } from "@/lib/github";

export default async function Home() {
  const stars = await getRepositoryStars();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-accent/25 selection:text-foreground">
      <Navbar starsCount={stars} />
      <main id="main-content" className="flex-1">
        <Hero />
        <StudentServices />
        <PublicApiSurface />
        <PublicStats />
      </main>
      <Footer />
    </div>
  );
}
