/**
 * Merapikan teks rangkuman / berita acara MyBest yang datang sebagai satu paragraf panjang
 * ("JUDUL • Subjudul • Poin. • Poin. • ...") menjadi judul, subjudul, dan poin-poin.
 */

export interface NoteSection {
  heading?: string;
  items: string[];
}

export interface ParsedNote {
  /** "Pertemuan 1" bila judul diawali nomor pertemuan. */
  label?: string;
  title?: string;
  sections: NoteSection[];
  /** Kalimat penutup (mis. "Kegiatan perkuliahan telah dilaksanakan ...") yang bukan poin materi. */
  closing?: string;
}

const BULLET_SPLIT = /\s*[•●▪◦·]\s*|\r?\n+\s*(?:[-*–]\s+|\d{1,2}[.)]\s+)?/;
const SMALL_WORDS = new Set(["dan", "di", "ke", "dari", "yang", "untuk", "dengan", "pada", "atau", "serta", "dalam", "of", "and"]);

const collapse = (v: string) => v.replace(/\s+/g, " ").trim();
const endsSentence = (v: string) => /[.!?;:]["')\]]?$/.test(v);

function isMostlyUpper(v: string) {
  const letters = v.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4) return false;
  return letters.replace(/[^A-Z]/g, "").length / letters.length > 0.7;
}

/** Huruf besar semua -> Title Case; singkatan tanpa vokal (PLN, SQL) tetap kapital. */
function titleCase(v: string) {
  if (!isMostlyUpper(v)) return v;
  return v
    .split(" ")
    .map((word, i) => {
      if (/^[^AEIOUaeiou]{2,5}$/.test(word) && /^[A-Z]+$/.test(word)) return word;
      const lower = word.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function sentenceCase(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function splitSentences(v: string) {
  return v.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
}

export function parseNote(raw?: string | null): ParsedNote | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  const segments = text.split(BULLET_SPLIT).map(collapse).filter(Boolean);
  if (!segments.length) return null;

  const result: ParsedNote = { sections: [] };
  const hasBullets = segments.length > 1;

  // Judul: segmen pertama bila pendek / huruf besar semua dan bukan kalimat biasa.
  let rest = segments;
  const first = segments[0];
  const startsWithBullet = /^\s*[•●▪◦·]/.test(text);
  const titleLike = isMostlyUpper(first) || (!endsSentence(first) && first.length <= 90 && segments.slice(1).some(endsSentence));
  if (hasBullets && !startsWithBullet && titleLike) {
    const parts = first.split(/\s+[–—-]\s+/);
    const meeting = parts.length > 1 ? parts[0].match(/^(pertemuan|pert\.?|minggu)\s*(ke-?)?\s*\d+$/i) : null;
    if (meeting) {
      result.label = titleCase(parts[0]);
      result.title = titleCase(parts.slice(1).join(": "));
    } else {
      result.title = titleCase(first);
    }
    rest = segments.slice(1);
  }

  const hasSentences = rest.some(endsSentence);
  const isHeading = (i: number) => {
    const seg = rest[i];
    if (!hasSentences || endsSentence(seg) || seg.length > 80 || seg.split(" ").length > 10) return false;
    // Subjudul hanya bila langsung diikuti poin berupa kalimat.
    return i + 1 < rest.length && endsSentence(rest[i + 1]);
  };

  let current: NoteSection | null = null;
  const lastIndex = rest.length - 1;
  rest.forEach((seg, i) => {
    if (isHeading(i)) {
      current = { heading: titleCase(seg), items: [] };
      result.sections.push(current);
      return;
    }
    if (!current) {
      current = { items: [] };
      result.sections.push(current);
    }
    // Segmen terakhir yang berisi beberapa kalimat: kalimat pertama = poin, sisanya = penutup.
    if (hasBullets && i === lastIndex) {
      const sentences = splitSentences(seg);
      if (sentences.length > 1) {
        current.items.push(sentenceCase(sentences[0]));
        result.closing = sentences.slice(1).join(" ");
        return;
      }
    }
    current.items.push(sentenceCase(seg));
  });

  result.sections = result.sections.filter((s) => s.items.length || s.heading);
  return result;
}

/** Teks datar singkat untuk pratinjau satu baris (judul bila ada, bila tidak kalimat pertama). */
export function notePreview(raw?: string | null): string {
  const note = parseNote(raw);
  if (!note) return "";
  const head = [note.label, note.title].filter(Boolean).join(": ");
  return head || note.sections[0]?.items[0] || "";
}

/** Dua catatan dianggap sama bila isinya identik setelah spasi dan huruf besar/kecil dinormalkan. */
export function sameNote(a?: string | null, b?: string | null) {
  const norm = (v?: string | null) => collapse(v ?? "").toLowerCase();
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}
