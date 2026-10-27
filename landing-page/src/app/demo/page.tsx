"use client";

/**
 * Halaman demo publik (/demo): dashboard contoh dengan data 100% PALSU
 * dari API mock backend (/v1/mock/*, aktif saat MOCK_MODE=1). Tanpa login,
 * tanpa data mahasiswa asli. Desain mengikuti dashboard utama apa adanya.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FlaskConical, BookOpen, ClipboardList, GraduationCap, ExternalLink } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { TodayClassCard, type TodayClass } from "@/components/TodayClassCard";
import { findSubmission, formatShortDate, parseDeadline } from "@/lib/assignments";
import { dayIndex, sessionTiming, shortDate } from "@/lib/schedule";

interface MockProfile {
  nim: string;
  nama: string;
  program_studi: string;
  lokasi_cabang: string;
  kelas: string;
}
interface MockScheduleItem {
  id: string;
  kode: string;
  nama: string;
  hari: string;
  jam: string;
  sks: number;
  ruang: string;
  kode_dosen: string;
}
interface MockCourse {
  kode: string;
  nama: string;
  hari: string;
  ruang?: string;
  kode_dosen?: string;
  token_absen?: string;
}
interface MockTask {
  id: string;
  kode: string;
  judul: string;
  mata_kuliah: string;
  selesai: string;
}
interface MockSubmission {
  id: string;
  judul: string;
  kode: string;
}
interface MockKhs {
  items: { no: number; kode: string; mata_kuliah: string; sks: number; nilai: string; mutu: number }[];
  total_sks: number;
  ipk: number;
}
interface MockPresence {
  status_sesi: string | null;
  can_submit: boolean;
  present_today: boolean;
}

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

export default function DemoPage() {
  const [profile, setProfile] = useState<MockProfile | null>(null);
  const [schedule, setSchedule] = useState<MockScheduleItem[]>([]);
  const [courses, setCourses] = useState<MockCourse[]>([]);
  const [tasks, setTasks] = useState<MockTask[]>([]);
  const [submissions, setSubmissions] = useState<MockSubmission[]>([]);
  const [khs, setKhs] = useState<MockKhs | null>(null);
  const [presence, setPresence] = useState<MockPresence | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 30_000);
    Promise.allSettled([
      apiFetch<MockProfile>("/v1/mock/profile"),
      apiFetch<{ items: MockScheduleItem[] }>("/v1/mock/schedule"),
      apiFetch<MockCourse[]>("/v1/mock/courses"),
      apiFetch<{ tasks: MockTask[]; submissions: MockSubmission[] }>("/v1/mock/assignments"),
      apiFetch<MockKhs>("/v1/mock/khs"),
      apiFetch<MockPresence>("/v1/mock/presence"),
    ]).then(([p, s, c, a, k, pr]) => {
      if (p.status === "fulfilled") setProfile(p.value);
      if (s.status === "fulfilled") setSchedule(s.value.items ?? []);
      if (c.status === "fulfilled") setCourses(Array.isArray(c.value) ? c.value : []);
      if (a.status === "fulfilled") {
        setTasks(a.value.tasks ?? []);
        setSubmissions(a.value.submissions ?? []);
      }
      if (k.status === "fulfilled") setKhs(k.value);
      if (pr.status === "fulfilled") setPresence(pr.value);
      if (p.status === "rejected") setFailed(true);
    });
    return () => clearInterval(tick);
  }, []);

  const todayIdx = now ? now.getDay() : -1;

  const todayClasses: TodayClass[] = useMemo(() => {
    if (!now) return [];
    return (schedule ?? [])
      .filter((s) => dayIndex(s.hari) === todayIdx)
      .map((s) => {
        const match =
          courses.find((c) => norm(c.kode) && norm(c.kode) === norm(s.kode) && dayIndex(c.hari) === todayIdx) ||
          courses.find((c) => norm(c.kode) && norm(c.kode) === norm(s.kode)) ||
          courses.find((c) => norm(c.nama) === norm(s.nama));
        return {
          key: s.id || `${s.kode}-${s.jam}`,
          kode: s.kode,
          nama: s.nama,
          jam: s.jam,
          ruang: s.ruang || "",
          sks: s.sks,
          kode_dosen: s.kode_dosen,
          token: match?.token_absen ?? null,
          timing: sessionTiming(s.hari, s.jam, now),
        };
      });
  }, [schedule, courses, now, todayIdx]);

  const pendingTasks = tasks.filter((t) => !findSubmission(t, submissions));

  return (
    <main id="main-content" className="mx-auto min-h-screen w-full max-w-3xl space-y-7 px-4 py-6 sm:py-10">
      {/* Banner mode demo */}
      <section
        className="overflow-hidden bg-white shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#9CC6E0]"
        role="status"
        aria-label="Status mode demo"
      >
        <div className="flex items-start gap-3 bg-[#FEF3C7] px-4 py-3.5 sm:px-6">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-[#92400E]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#78350F]">Mode Demo</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-[#92400E]">
              Semua data di halaman ini PALSU dan dibuat otomatis untuk demo. Tidak ada data mahasiswa asli.
            </p>
          </div>
        </div>
      </section>

      {failed ? (
        <section className="overflow-hidden bg-white p-6 shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#9CC6E0]">
          <p className="text-sm text-[#163A55]">
            API demo belum aktif di server ini (butuh <code className="font-mono text-[13px]">MOCK_MODE=1</code>).
          </p>
        </section>
      ) : (
        <>
          {/* Ringkasan profil + hari ini */}
          <section className="overflow-hidden bg-white shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#9CC6E0]" aria-label="Ringkasan hari ini">
            <div className="bg-[#0369A1] px-4 pb-5 pt-4 text-white sm:px-6 sm:pb-6 sm:pt-5">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                {now ? shortDate(now) : ""}
              </p>
              <h1 className="mt-1.5 break-words text-[1.6rem] font-display font-bold leading-tight tracking-tight sm:text-3xl">
                {profile?.nama ?? "..."}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-white/85">
                <span className="font-mono font-semibold text-white">{profile?.nim ?? "-"}</span>
                <span aria-hidden="true">·</span>
                <span>{profile?.program_studi ?? "-"}</span>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">{profile?.lokasi_cabang ?? ""}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 border-b-2 border-[#EAF3F9] px-4 py-3.5 sm:px-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#EAF3F9] text-[#0369A1]">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#163A55]">
                  {todayClasses.length > 0 ? `${todayClasses.length} kelas hari ini` : "Tidak ada kelas hari ini"}
                </p>
                <p className="mt-0.5 text-[12px] text-[#5B7A8C]">
                  {presence?.present_today ? "Presensi tercatat." : "Contoh status presensi dashboard."}
                </p>
              </div>
            </div>
            {todayClasses.length > 0 && (
              <ol className="divide-y divide-[#EAF3F9]">
                {todayClasses.map((c) => (
                  <li key={c.key}>
                    <TodayClassCard item={c} />
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Tugas */}
          <section className="overflow-hidden bg-white shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#9CC6E0]" aria-label="Tugas">
            <h2 className="flex items-center gap-2 border-b-2 border-[#EAF3F9] px-4 py-3.5 text-sm font-bold text-[#163A55] sm:px-6">
              <ClipboardList className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
              Tugas ({pendingTasks.length} belum dikumpul)
            </h2>
            <ul className="divide-y divide-[#EAF3F9]">
              {pendingTasks.map((t) => (
                <li key={t.id} className="px-4 py-3 sm:px-6">
                  <p className="text-sm font-semibold text-[#163A55]">{t.judul}</p>
                  <p className="mt-0.5 text-[12px] text-[#5B7A8C]">
                    {t.mata_kuliah} | Batas: {formatShortDate(parseDeadline(t.selesai), t.selesai)}
                  </p>
                </li>
              ))}
              {pendingTasks.length === 0 && <li className="px-4 py-3 text-[13px] text-[#5B7A8C] sm:px-6">Semua tugas contoh sudah dikumpul.</li>}
            </ul>
          </section>

          {/* KHS */}
          {khs && (
            <section className="overflow-hidden bg-white shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#9CC6E0]" aria-label="Kartu Hasil Studi">
              <h2 className="flex items-center gap-2 border-b-2 border-[#EAF3F9] px-4 py-3.5 text-sm font-bold text-[#163A55] sm:px-6">
                <GraduationCap className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                KHS Contoh (IPK {khs.ipk.toFixed(2)} | {khs.total_sks} SKS)
              </h2>
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-[#EAF3F9]">
                  {khs.items.map((it) => (
                    <tr key={it.kode}>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-[#5B7A8C] sm:px-6">{it.kode}</td>
                      <td className="py-2.5 font-semibold text-[#163A55]">{it.mata_kuliah}</td>
                      <td className="px-2 py-2.5 text-right text-[#5B7A8C]">{it.sks} SKS</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#0369A1] sm:px-6">{it.nilai}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-[#5B7A8C]">
        Demo Mira |{" "}
        <Link href="/docs" className="inline-flex items-center gap-0.5 font-semibold text-[#0369A1] hover:underline">
          Dokumentasi API <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </p>
    </main>
  );
}
