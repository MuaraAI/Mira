import { parseNote } from "@/lib/notes";

/** Rangkuman / berita acara yang sudah dirapikan: judul, subjudul, dan poin-poin. */
export function FormattedNote({ text, tone = "primary" }: { text: string; tone?: "primary" | "muted" }) {
  const note = parseNote(text);
  if (!note) return null;
  const body = tone === "muted" ? "text-secondary" : "text-foreground";

  // Teks tanpa penanda poin: tampilkan sebagai paragraf biasa.
  const plain = !note.title && note.sections.length === 1 && note.sections[0].items.length === 1 && !note.sections[0].heading;

  return (
    <div className={`max-w-3xl space-y-4 ${body}`}>
      {note.title && (
        <div>
          {note.label && (
            <span className="mb-1.5 inline-block bg-px-highlight px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#0369A1]">
              {note.label}
            </span>
          )}
          <h4 className="font-display text-base font-bold leading-snug text-foreground sm:text-lg">{note.title}</h4>
        </div>
      )}

      {plain ? (
        <p className="leading-relaxed">{note.sections[0].items[0]}</p>
      ) : (
        note.sections.map((section, i) => (
          <section key={i} className="space-y-2">
            {section.heading && (
              <h5 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-[#0369A1]" />
                {section.heading}
              </h5>
            )}
            <ul className={`space-y-1.5 ${section.heading ? "pl-4" : ""}`}>
              {section.items.map((item, j) => (
                <li key={j} className="flex gap-2.5 leading-relaxed">
                  <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 bg-[#7FB4D3]" />
                  <span className="min-w-0 break-words">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {note.closing && (
        <p className="border-l-4 border-px-soft bg-px-tint px-3 py-2 text-sm leading-relaxed text-secondary">{note.closing}</p>
      )}
    </div>
  );
}
