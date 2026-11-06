import React from "react";
import { SCENES, T, VO } from "../timeline";
import WORDS from "../vo-words.json";
import { clamp } from "../lib/anim";

/**
 * Subtitle narasi dengan font Jersey 25 (pixel, senada dengan Pixelify di Mira).
 * Waktu tiap kata diambil dari klip narasi asli (src/vo-words.json, dibuat scripts/gen-vo.mjs),
 * jadi kata yang sedang diucapkan menyala kuning #FCD34D, sama dengan "Satu pintu." di Mira.
 */

type Word = { t: string; s: number; e: number };
const TIMING = WORDS as Record<string, { bicara: number; words: Word[] }>;
const HOLD = 0.35; // subtitle bertahan sebentar setelah kalimat selesai

export type SubLine = { id: string; start: number; end: number; words: Word[]; place: "top" | "bottom" };

/**
 * Bagian yang isinya penting ada di bawah layar, jadi subtitle otomatis pindah ke atas:
 * form login Mira (tombol Masuk di bawah) dan chat Komunitas (pesan baru & kolom ketik di bawah).
 * Posisi diputuskan per kalimat supaya tidak melompat di tengah kalimat.
 */
const KOM = SCENES.find((s) => s.id === "komunitas")!;
const TOP_RANGES: [number, number][] = [
  [T.nimClick - 0.4, T.submitClick + 0.4],
  [KOM.start - 0.3, KOM.end],
];
const placeFor = (start: number) => (TOP_RANGES.some(([a, b]) => start >= a && start < b) ? "top" : "bottom");

export const SUB_LINES: SubLine[] = VO.map((v, i) => {
  const w = TIMING[v.id];
  const speechEnd = v.start + (w?.bicara ?? v.end - v.start);
  const next = VO[i + 1];
  const end = Math.min(speechEnd + HOLD, next ? next.start - 0.06 : speechEnd + HOLD);
  return { id: v.id, start: v.start, end, words: w?.words ?? v.text.split(/\s+/).map((t) => ({ t, s: 0, e: 0 })), place: placeFor(v.start) };
});

export function lineAt(t: number) {
  return SUB_LINES.find((l) => t >= l.start - 0.04 && t < l.end) ?? null;
}

/** Kata yang sedang diucapkan (indeks), -1 bila sedang jeda. */
function activeWord(line: SubLine, t: number) {
  const tau = t - line.start;
  for (let i = line.words.length - 1; i >= 0; i--) if (tau >= line.words[i].s - 0.03) return tau <= line.words[i].e + 0.18 ? i : -1;
  return -1;
}

export const SubtitleText: React.FC<{ t: number; line: SubLine; size: number; highlight?: string }> = ({ t, line, size, highlight = "#FCD34D" }) => {
  const k = activeWord(line, t);
  return (
    <span style={{ fontFamily: "'Jersey 25', 'Pixelify Sans', system-ui, sans-serif", fontSize: size, lineHeight: 1.08, letterSpacing: "0.025em", textWrap: "balance" as React.CSSProperties["textWrap"] }}>
      {line.words.map((w, i) => (
        <React.Fragment key={i}>
          <span style={{ color: i === k ? highlight : "#FFFFFF" }}>{w.t}</span>
          {i < line.words.length - 1 ? " " : ""}
        </React.Fragment>
      ))}
    </span>
  );
};

/** Subtitle untuk video 16:9: kotak tinta di bawah tengah, ringkas, tidak menutupi UI penting. */
export const Subtitles: React.FC<{ t: number; size?: number; bottom?: number; maxWidth?: number }> = ({ t, size = 54, bottom = 42, maxWidth = 1320 }) => {
  const line = lineAt(t);
  if (!line) return null;
  const inP = clamp((t - (line.start - 0.04)) / 0.12);
  const outP = clamp((line.end - t) / 0.12);
  const p = Math.min(inP, outP);
  const top = line.place === "top";
  return (
    <div style={{ position: "absolute", left: 0, right: 0, ...(top ? { top: 34 } : { bottom }), display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: top ? Math.min(maxWidth, 1080) : maxWidth,
          padding: "8px 22px 11px",
          textAlign: "center",
          background: "rgba(7, 32, 51, 0.88)",
          boxShadow: "0 0 0 2px rgba(22, 58, 85, 0.95), 5px 5px 0 2px rgba(3, 105, 161, 0.55)",
          opacity: p,
          transform: `translateY(${(1 - p) * (top ? -8 : 8)}px)`,
        }}
      >
        <SubtitleText t={t} line={line} size={size} />
      </div>
    </div>
  );
};
