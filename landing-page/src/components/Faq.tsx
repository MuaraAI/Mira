import { FAQ } from "@/lib/site";
import { FaqAccordion } from "./FaqAccordion";
import { RevealOnScroll } from "./HomeParallax";

/** FAQ publik: dibaca manusia, mesin pencari, dan AI search lewat teks biasa serta JSON-LD FAQPage. */
export function Faq() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <section
      id="faq"
      className="bg-background py-12 sm:py-24 scroll-mt-24"
      aria-labelledby="faq-title"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:gap-10 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16 lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <RevealOnScroll>
            <h2
              id="faq-title"
              className="text-[clamp(1.6rem,3.2vw,2.2rem)] leading-[1.18] tracking-[-0.005em] text-foreground"
            >
              Sering ditanyakan
            </h2>
            <p className="mt-3 max-w-sm text-[13.5px] leading-[1.75] tracking-[0.012em] text-secondary sm:mt-4 sm:text-[14.5px]">
              Jawaban ringkas tentang akses kampus, keamanan akun, dan cara kerja Mira.
            </p>
            <a
              href="mailto:admin@muaraai.com"
              className="mt-4 inline-flex min-h-[44px] items-center text-[13px] tracking-[0.012em] text-[#0369A1] underline underline-offset-4 transition-colors hover:text-[#075985] sm:mt-5"
            >
              Hubungi tim Muara AI
            </a>
          </RevealOnScroll>
        </div>

        <RevealOnScroll delayMs={60}>
          <FaqAccordion items={FAQ} />
        </RevealOnScroll>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
