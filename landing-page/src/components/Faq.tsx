import { FAQ } from "@/lib/site";

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
    <section id="faq" className="border-t-2 border-px-soft bg-surface-alt/60" aria-labelledby="faq-title">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <p className="section-kicker mb-4">Pertanyaan umum</p>
        <h2 id="faq-title" className="font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
          Tentang UBSI-API Muara
        </h2>

        <div className="mt-8 space-y-4 p-[2px]">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="px-card group bg-white open:[--px-line:#0369A1]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left sm:px-5 [&::-webkit-details-marker]:hidden">
                <h3 className="text-sm font-bold text-foreground sm:text-base">{q}</h3>
                <span className="shrink-0 font-mono text-lg font-bold text-[#0369A1] transition-transform duration-200 group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="border-t-2 border-dashed border-px-soft px-4 py-4 text-sm leading-relaxed text-secondary sm:px-5">{a}</p>
            </details>
          ))}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
