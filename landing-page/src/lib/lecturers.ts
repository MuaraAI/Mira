"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface LecturerRow {
  kode: string;
  nama: string;
}

const TTL_MS = 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;

let cached: { map: Map<string, string>; at: number; ok: boolean } | null = null;
let inflight: Promise<Map<string, string>> | null = null;

// Gelar yang ditulis ulang dengan huruf besar-kecil baku.
const TITLES: Record<string, string> = {
  "dr": "Dr.", "drs": "Drs.", "dra": "Dra.", "ir": "Ir.", "prof": "Prof.", "h": "H.", "hj": "Hj.",
  "s.kom": "S.Kom.", "m.kom": "M.Kom.", "s.t": "S.T.", "m.t": "M.T.", "s.e": "S.E.", "m.m": "M.M.",
  "s.si": "S.Si.", "m.si": "M.Si.", "s.pd": "S.Pd.", "m.pd": "M.Pd.", "s.h": "S.H.", "m.h": "M.H.",
  "s.ti": "S.TI.", "m.ti": "M.TI.", "m.cs": "M.CS.", "m.sc": "M.Sc.", "ph.d": "Ph.D.", "m.ak": "M.Ak.",
  "s.sos": "S.Sos.", "m.sc.": "M.Sc.", "m.eng": "M.Eng.", "s.ds": "S.Ds.", "s.kom.i": "S.Kom.I.",
  "m.kom.": "M.Kom.", "m.stat": "M.Stat.", "s.stat": "S.Stat.", "s.ak": "S.Ak.", "m.a": "M.A.",
  "mm": "M.M.", "mti": "M.TI.", "mkom": "M.Kom.", "skom": "S.Kom.", "mt": "M.T.", "st": "S.T.",
};

const titleCaseWord = (word: string) =>
  word
    .toLowerCase()
    .replace(/(^|[-'’])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());

function formatTitle(raw: string) {
  const key = raw.trim().toLowerCase().replace(/\.$/, "").replace(/\s+/g, "");
  if (TITLES[key]) return TITLES[key];
  // Gelar tak dikenal: huruf besar di awal tiap bagian, contoh "M.KOM.T" -> "M.Kom.T."
  const parts = key.split(".").filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return parts.length ? `${parts.join(".")}.` : raw.trim();
}

/** "BUDI SANTOSO, S.KOM., M.KOM." -> "Budi Santoso, S.Kom., M.Kom." */
export function formatLecturerName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const [namePart, ...titleParts] = cleaned.split(",");
  // Gelar di depan nama ("DR. IR. BUDI"): kata berakhir titik yang dikenal sebagai gelar.
  const words = namePart
    .trim()
    .split(" ")
    .map((w) => (TITLES[w.toLowerCase().replace(/\.$/, "")] && w.endsWith(".") ? formatTitle(w) : titleCaseWord(w)));
  const titles = titleParts.map(formatTitle).filter(Boolean);
  return [words.join(" "), ...titles].join(", ");
}

async function loadDirectory(): Promise<Map<string, string>> {
  if (cached && Date.now() - cached.at < (cached.ok ? TTL_MS : RETRY_MS)) return cached.map;
  if (inflight) return inflight;
  inflight = apiFetch<LecturerRow[]>("/v1/studentv2/lecturers")
    .then((rows) => {
      const map = new Map<string, string>();
      for (const row of Array.isArray(rows) ? rows : []) {
        const kode = row?.kode?.trim().toUpperCase();
        const nama = row?.nama ? formatLecturerName(row.nama) : "";
        if (kode && nama) map.set(kode, nama);
      }
      cached = { map, at: Date.now(), ok: map.size > 0 };
      return map;
    })
    .catch(() => {
      cached = { map: new Map(), at: Date.now(), ok: false };
      return cached.map;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function clearLecturerCache() {
  cached = null;
}

/** Direktori kode dosen -> nama (satu permintaan bersama untuk seluruh halaman). */
export function useLecturers() {
  const [state, setState] = useState<{ names: Map<string, string> | null }>(() => ({
    names: cached && Date.now() - cached.at < TTL_MS ? cached.map : null,
  }));

  useEffect(() => {
    let alive = true;
    loadDirectory().then((names) => alive && setState({ names }));
    return () => {
      alive = false;
    };
  }, []);

  return { names: state.names, loading: state.names === null };
}

export function lecturerName(names: Map<string, string> | null, kode?: string | null) {
  const key = kode?.trim().toUpperCase();
  return key && names ? names.get(key) ?? null : null;
}
