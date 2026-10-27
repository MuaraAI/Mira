/**
 * Helper jadwal kuliah berbahasa Indonesia yang tidak bergantung pada data locale browser.
 * `Intl.DateTimeFormat("id-ID")` bisa jatuh ke bahasa Inggris ("Monday") di browser/WebView
 * tanpa data locale Indonesia, sehingga mapel hari ini tidak terdeteksi.
 */

export const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const DAY_ALIASES: Record<string, number> = {
  minggu: 0, ahad: 0, sunday: 0, sun: 0,
  senin: 1, monday: 1, mon: 1,
  selasa: 2, tuesday: 2, tue: 2,
  rabu: 3, wednesday: 3, wed: 3,
  kamis: 4, thursday: 4, thu: 4,
  jumat: 5, "jum'at": 5, friday: 5, fri: 5,
  sabtu: 6, saturday: 6, sat: 6,
};

/** "Senin" / "monday" / "Jum'at" -> 0..6, atau null bila tidak dikenali. */
export function dayIndex(day?: string | null): number | null {
  const key = (day ?? "").trim().toLowerCase().replace(/[^a-z']/g, "");
  return key in DAY_ALIASES ? DAY_ALIASES[key] : null;
}

/** Nama hari baku Indonesia untuk nilai apa pun dari MyBest/SIAKAD. */
export function dayName(day?: string | null): string {
  const idx = dayIndex(day);
  return idx === null ? (day ?? "").trim() : DAY_NAMES[idx];
}

const pad = (n: number) => String(n).padStart(2, "0");

export function clock(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}.${pad(minutes % 60)}`;
}

/** "09:10-10:50" atau jam masuk/keluar -> [mulai, selesai] dalam menit sejak tengah malam. */
export function minutesRange(start?: string | null, end?: string | null, range?: string | null): [number, number] | null {
  const pick = (v?: string | null) => {
    const m = (v ?? "").match(/(\d{1,2})[:.](\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  let a = pick(start);
  let b = pick(end);
  if ((a === null || b === null) && range) {
    const parts = range.match(/(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/);
    if (parts) {
      a = pick(parts[1]);
      b = pick(parts[2]);
    }
  }
  return a !== null && b !== null ? [a, b] : null;
}

/** "Senin, 27 Okt" untuk tanggal tertentu. */
export function shortDate(date: Date): string {
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "2026-10-27" / "27-10-2026" / "27/10/2026" dari MyBest -> "Senin, 27 Okt 2026" (teks asli bila tidak dikenali). */
export function formatRecordDate(value?: string | null): string {
  const raw = (value ?? "").trim();
  const iso = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmy = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : dmy ? [Number(dmy[3]), Number(dmy[2]), Number(dmy[1])] : null;
  if (!parts) return raw;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export interface SessionTiming {
  /** Hari ke depan sampai kelas berikutnya (0 = hari ini). */
  daysAway: number;
  /** Tanggal kelas berikutnya. */
  date: Date;
  range: [number, number] | null;
  state: "upcoming" | "soon" | "live" | "done" | "later";
  /** Kalimat ringkas, mis. "Dimulai 25 menit lagi". */
  label: string;
}

/** Hitung kapan pertemuan mapel mingguan: hari ini (berlangsung/segera/nanti/selesai) atau N hari lagi. */
export function sessionTiming(day: string | null | undefined, jam: string | null | undefined, now: Date): SessionTiming | null {
  const idx = dayIndex(day);
  if (idx === null) return null;
  const range = minutesRange(null, null, jam);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const daysAway = (idx - now.getDay() + 7) % 7;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAway);

  if (daysAway === 0 && range) {
    const [start, end] = range;
    if (nowMin < start - 60) return { daysAway, date, range, state: "upcoming", label: `Hari ini pukul ${clock(start)}` };
    if (nowMin < start) return { daysAway, date, range, state: "soon", label: `Dimulai ${start - nowMin} menit lagi` };
    if (nowMin <= end) return { daysAway, date, range, state: "live", label: `Sedang berlangsung, selesai ${clock(end)}` };
    // Kelas hari ini yang sudah selesai tetap "hari ini" (presensi hari ini tetap yang ditampilkan).
    return { daysAway, date, range, state: "done", label: `Hari ini, selesai pukul ${clock(end)}` };
  }
  if (daysAway === 0) return { daysAway, date, range, state: "upcoming", label: "Hari ini" };
  const when = daysAway === 1 ? "Besok" : `${DAY_NAMES[idx]} (${daysAway} hari lagi)`;
  return { daysAway, date, range, state: "later", label: range ? `${when}, ${clock(range[0])}` : when };
}

/* ------------------------------------------------------------------ ruang */

export interface RoomInfo {
  mode: "online" | "offline" | "unknown";
  /** Kode asli dari kampus. */
  code: string;
  /** Penjelasan singkat untuk ditampilkan. */
  label: string;
  floor?: string;
  room?: string;
}

/**
 * Kode ruang UBSI ditentukan dari karakter PERTAMA:
 * - diawali angka (mis. "302", "304-P1") = kelas tatap muka; digit depan = lantai.
 *   "302" -> lantai 3 ruang 02; "304-P1" -> lantai 3 ruang 04, bagian P1.
 * - diawali huruf (mis. "EN2-P1", "EL2-P1") = kelas online/daring.
 */
export function describeRoom(raw?: string | null): RoomInfo {
  const code = (raw ?? "").trim();
  if (!code || code === "-") return { mode: "unknown", code: "", label: "Ruang belum ada" };
  if (/^\d/.test(code)) {
    const digits = code.match(/^\d+/)?.[0] ?? "";
    const suffix = code.slice(digits.length).replace(/^[-\s]+/, "");
    if (digits.length >= 3) {
      const floor = digits.slice(0, digits.length - 2);
      const room = digits.slice(-2);
      const part = suffix ? ` (${suffix})` : "";
      return { mode: "offline", code, floor, room, label: `Tatap muka · Lantai ${Number(floor)}, Ruang ${room}${part}` };
    }
    return { mode: "offline", code, label: `Tatap muka · Ruang ${code}` };
  }
  if (/^[a-z]/i.test(code)) return { mode: "online", code, label: `Online · ${code}` };
  return { mode: "unknown", code, label: `Ruang ${code}` };
}

/** Prioritas mapel untuk dipilih otomatis: hari ini dulu (berlangsung > segera > nanti > selesai), lalu hari berikutnya. */
export function timingRank(t: SessionTiming | null): number {
  if (!t) return 99_000;
  const start = t.range?.[0] ?? 0;
  if (t.daysAway === 0) {
    const order = { live: 0, soon: 1, upcoming: 2, done: 3, later: 2 }[t.state];
    // Untuk kelas selesai, yang paling baru selesai di depan.
    return order * 10_000 + (t.state === "done" ? 2_000 - start : start);
  }
  return 40_000 + t.daysAway * 2_000 + start;
}
