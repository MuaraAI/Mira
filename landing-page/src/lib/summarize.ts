/**
 * Ringkasan otomatis dari teks PDF (soal tugas, modul, slide) tanpa AI dan tanpa server:
 * pemilihan kalimat penting berdasarkan frekuensi kata, ditambah daftar perintah yang harus
 * dikerjakan, kerangka (judul bagian), dan kata kunci. Berjalan penuh di browser.
 */

export interface PdfSummary {
  title: string | null;
  /** Kalimat paling penting, urut sesuai dokumen. */
  summary: string[];
  /** Perintah / syarat pengumpulan yang ditemukan (kerjakan, buat, kumpulkan, format, batas). */
  tasks: string[];
  /** Kerangka dokumen dari judul bagian. */
  outline: string[];
  keywords: string[];
  pages: number;
  words: number;
}

const STOPWORDS = new Set(
  (
    "yang dan di ke dari untuk pada dengan atau dalam adalah itu ini juga akan dapat dapat oleh sebagai " +
    "tidak ada para antara sudah telah masih lebih sangat saat bila jika maka karena sehingga agar supaya " +
    "serta bagi kita kami anda saya mereka dia nya tersebut yaitu yakni dimana mana apa bagaimana " +
    "seperti setiap semua beberapa banyak suatu satu dua tiga hal cara oleh secara dalam atas bawah " +
    "the and for with that this from are was were has have not can will your you its into than then " +
    "pertemuan halaman gambar tabel"
  ).split(/\s+/),
);

const TASK_CUE =
  /^(?:\d+[.)]\s*|[a-z][.)]\s*|[-•●▪]\s*)?(kerjakan|buat(?:lah)?|susun(?:lah)?|tulis(?:kan)?|jelaskan|analisis(?:lah)?|implementasi(?:kan)?|rancang(?:lah)?|kumpul(?:kan)?|unggah|upload|kirim(?:kan)?|lengkapi|jawab(?:lah)?|hitung|bandingkan|carilah|cari|diskusikan|presentasikan|simpulkan|gambarkan|identifikasi|tentukan|uraikan|sebutkan|lakukan|gunakan|siapkan|pastikan|tuliskan|screenshot|sertakan|lampirkan)\b/i;
const TASK_INFO = /(batas|deadline|paling lambat|dikumpulkan|pengumpulan|format|maksimal|minimal|ketentuan|syarat|penilaian|bobot|wajib|link|google drive|\.pdf|\.docx|\.zip)/i;
const CUE_WORDS = /(tujuan|bertujuan|merupakan|adalah|dimaksud|kesimpulan|ringkasan|penting|prinsip|definisi|pengertian|konsep)/i;

const clean = (v: string) => v.replace(/\s+/g, " ").trim();

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-zà-ÿ]{3,}/g) ?? []).filter((w) => !STOPWORDS.has(w));
}

function looksLikeHeading(line: string) {
  if (line.length < 3 || line.length > 80 || /[.!?;,]$/.test(line)) return false;
  const letters = line.replace(/[^A-Za-z]/g, "");
  const upper = letters.replace(/[^A-Z]/g, "").length;
  const numbered = /^(?:bab\s+[ivx\d]+|\d+(?:\.\d+)*[.)]?\s+[A-Z]|[A-Z][.)]\s+[A-Z])/i.test(line);
  const titleCase = /^[A-Z]/.test(line) && line.split(" ").filter((w) => /^[A-Z]/.test(w)).length >= Math.ceil(line.split(" ").length * 0.6);
  return (letters.length >= 4 && upper / letters.length > 0.7) || numbered || (titleCase && line.split(" ").length <= 8);
}

/** Buang nomor halaman dan kepala/kaki halaman yang berulang di banyak halaman. */
function stripRepeated(pages: string[]): string[][] {
  const split = pages.map((p) => p.split(/\n+/).map(clean).filter(Boolean));
  const seen = new Map<string, number>();
  split.forEach((lines) => new Set(lines).forEach((l) => seen.set(l, (seen.get(l) ?? 0) + 1)));
  const repeatLimit = Math.max(3, Math.ceil(pages.length * 0.5));
  return split.map((lines) =>
    lines.filter((l) => !/^(?:hal(?:aman)?\.?\s*)?\d{1,3}(?:\s*(?:\/|dari|of)\s*\d{1,3})?$/i.test(l) && !/^[_\-=.·•\s]{3,}$/.test(l) && (pages.length < 3 || (seen.get(l) ?? 0) < repeatLimit)),
  );
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/)
    .map(clean)
    .filter((s) => s.length > 0);
}

function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0;
  a.forEach((x) => b.has(x) && inter++);
  return inter / (a.size + b.size - inter || 1);
}

const trim = (s: string, max = 220) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

export function summarizePdfText(pages: string[]): PdfSummary {
  const lines = stripRepeated(pages);
  const flat = lines.flat();
  const outline: string[] = [];
  const items: string[] = []; // butir bernomor / bullet
  const paragraphs: string[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) paragraphs.push(buffer.trim());
    buffer = "";
  };

  let title: string | null = null;
  for (const line of flat) {
    if (/^(?:\d+[.)]|[a-z][.)]|[-•●▪])\s+\S/.test(line)) {
      flush();
      items.push(line.replace(/^(?:\d+[.)]|[a-z][.)]|[-•●▪])\s+/, ""));
      continue;
    }
    if (looksLikeHeading(line)) {
      flush();
      if (!title) title = line;
      else if (!outline.includes(line) && outline.length < 12) outline.push(line);
      continue;
    }
    buffer += `${buffer ? " " : ""}${line}`;
    if (/[.!?]$/.test(line)) flush();
  }
  flush();

  const sentences = paragraphs.flatMap(splitSentences).filter((s) => s.split(" ").length >= 6 && s.split(" ").length <= 45);
  const allItems = items.filter((i) => i.length >= 8);
  const text = [...sentences, ...allItems].join(" ");
  const wordCount = (text.match(/\S+/g) ?? []).length;

  // Skor kalimat: jumlah frekuensi kata penting (dinormalkan panjang) + bonus posisi dan kata petunjuk.
  const freq = new Map<string, number>();
  tokens(text).forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
  const scored = sentences.map((s, index) => {
    const toks = tokens(s);
    const base = toks.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / Math.pow(toks.length || 1, 0.6);
    const position = index < 3 ? 1.25 : 1;
    const cue = CUE_WORDS.test(s) ? 1.2 : 1;
    const noisy = /https?:\/\/|\d{6,}/.test(s) ? 0.5 : 1;
    return { s, index, score: base * position * cue * noisy, set: new Set(toks) };
  });

  const target = wordCount < 250 ? 3 : wordCount < 900 ? 5 : 7;
  const chosen: typeof scored = [];
  [...scored]
    .sort((a, b) => b.score - a.score)
    .forEach((c) => {
      if (chosen.length >= target) return;
      if (chosen.some((x) => jaccard(x.set, c.set) > 0.6)) return;
      chosen.push(c);
    });
  const summary = chosen.sort((a, b) => a.index - b.index).map((c) => trim(c.s, 260));

  const taskCandidates = [...allItems, ...sentences];
  const tasks: string[] = [];
  for (const candidate of taskCandidates) {
    const t = clean(candidate);
    if (t.length < 12 || tasks.some((x) => jaccard(new Set(tokens(x)), new Set(tokens(t))) > 0.6)) continue;
    if (TASK_CUE.test(t) || (TASK_INFO.test(t) && t.length < 200)) tasks.push(trim(t));
    if (tasks.length >= 8) break;
  }

  const keywords = [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  // Dokumen berupa slide/butir saja (tanpa kalimat utuh): ringkas dari butir terpanjang.
  if (!summary.length && allItems.length) summary.push(...allItems.slice(0, target).map((i) => trim(i, 200)));

  return { title: title ? trim(title, 120) : null, summary, tasks, outline, keywords, pages: pages.length, words: wordCount };
}
