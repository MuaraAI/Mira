"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  UserCheck,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { apiFetch, useApi, clearApiCache } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/dashboard-ui";
import { CourseSelect } from "@/components/CourseSelect";
import { resolveDosen } from "@/lib/courses";
import { DosenInfo } from "@/components/DosenInfo";
import { FormattedNote } from "@/components/FormattedNote";
import { notePreview, sameNote } from "@/lib/notes";

interface CourseItem {
  id: string;
  kode?: string;
  kode_mtk?: string;
  nama: string;
  hari?: string;
  jam?: string;
  ruang?: string;
  kode_dosen?: string;
  dosen_code?: string;
  token_absen?: string | null;
}

interface PresenceRecord {
  id: string;
  status_absen: string;
  tanggal: string;
  matakuliah?: string;
  pertemuan: string;
  rangkuman?: string | null;
  berita_acara?: string | null;
  dosen?: string | null;
  ruang?: string | null;
}

interface PresenceData {
  kode_mtk?: string;
  matakuliah?: string;
  kelas?: string;
  dosen?: string;
  ruang?: string;
  hari?: string;
  jam_masuk?: string;
  jam_keluar?: string;
  status_sesi?: string | null;
  can_submit?: boolean;
  total_kehadiran?: number;
  /** Sudah absen hari ini menurut rekap MyBest. */
  present_today?: boolean;
  riwayat?: PresenceRecord[];
}

type Phase = "present" | "open" | "waiting" | "live" | "ended" | "off";

/** "12:30-15:00" atau jam_masuk/jam_keluar -> menit sejak tengah malam. */
function minutesRange(start?: string | null, end?: string | null, range?: string | null): [number, number] | null {
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

const PHASE_COPY: Record<Phase, { chip: string; button: string }> = {
  present: { chip: "Sudah Absen", button: "Sudah absen hari ini" },
  open: { chip: "Absen Dibuka", button: "Absen Sekarang" },
  waiting: { chip: "Belum Dimulai", button: "Belum waktunya absen" },
  live: { chip: "Menunggu Dosen", button: "Menunggu dosen membuka absen" },
  ended: { chip: "Kelas Selesai", button: "Sesi absen sudah selesai" },
  off: { chip: "Bukan Hari Kuliah", button: "Tidak ada kelas hari ini" },
};

const DAY_ORDER = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

export default function PresensiPage() {
  const coursesApi = useApi<CourseItem[]>("/v1/elearning/courses");
  // Cadangan kode dosen dari jadwal SIAKAD.
  const scheduleApi = useApi<{ kode: string; nama: string; kode_dosen?: string }[]>("/v1/studentv2/schedule");
  const [openRecord, setOpenRecord] = useState<string | null>(null);
  const [selectedCourseKey, setSelectedCourseKey] = useState<string | null>(null);

  const rawCourses = coursesApi.data ?? [];
  const todayDayIndex = new Date().getDay();
  const todayName = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(new Date());

  // Urutkan mata kuliah:
  // 1. Hari ini (distance 0) paling depan di posisi pertama
  // 2. Jika hari ini tidak ada jadwal (libur), prioritaskan hari berikutnya (besok, lusa, dst)
  const courses = useMemo(() => {
    function getDistance(courseDay?: string): number {
      if (!courseDay) return 99;
      const clean = courseDay.toLowerCase().trim();
      const idx = DAY_ORDER.indexOf(clean);
      if (idx === -1) return 99;
      return (idx - todayDayIndex + 7) % 7;
    }

    return [...rawCourses].sort((a, b) => {
      const distA = getDistance(a.hari);
      const distB = getDistance(b.hari);
      if (distA !== distB) return distA - distB;
      return (a.jam || "").localeCompare(b.jam || "");
    });
  }, [rawCourses, todayDayIndex]);

  // Dari tombol "Absen" di Jadwal: /dashboard/presensi?kode=...&mk=... langsung memilih mata kuliahnya.
  const [requested, setRequested] = useState<{ kode: string; mk: string } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kode = params.get("kode")?.trim() ?? "";
    const mk = params.get("mk")?.trim() ?? "";
    if (kode || mk) setRequested({ kode, mk });
  }, []);
  useEffect(() => {
    if (!requested || courses.length === 0) return;
    const norm = (v?: string) => (v ?? "").trim().toLowerCase();
    const match =
      courses.find((c) => requested.kode && (norm(c.kode) === norm(requested.kode) || norm(c.kode_mtk) === norm(requested.kode))) ||
      courses.find((c) => requested.mk && norm(c.nama) === norm(requested.mk)) ||
      courses.find((c) => requested.mk && (norm(c.nama).includes(norm(requested.mk)) || norm(requested.mk).includes(norm(c.nama))));
    if (match) setSelectedCourseKey(match.id || match.kode || match.nama);
    setRequested(null);
  }, [requested, courses]);

  const activeCourse = useMemo(() => {
    if (selectedCourseKey) {
      return (
        courses.find((c) => (c.id || c.kode || c.nama) === selectedCourseKey) ||
        courses[0] ||
        null
      );
    }
    return courses[0] || null;
  }, [courses, selectedCourseKey]);

  const token = activeCourse?.token_absen;

  // Kunci mata kuliah yang baru saja diabsen; menjaga tampilan "sudah absen" sampai rekap MyBest ikut terbarui.
  const [justPresent, setJustPresent] = useState<string | null>(null);
  const [serverPresent, setServerPresent] = useState(false);

  // Jam berjalan (menit) untuk menentukan fase sesi; diperbarui tiap 15 detik.
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const nowMinutes = clock.getHours() * 60 + clock.getMinutes();
  const courseIsToday = activeCourse?.hari?.toLowerCase().trim() === todayName.toLowerCase();
  const courseRange = minutesRange(null, null, activeCourse?.jam);
  // Polling hemat: cepat hanya saat sesi absen bisa dibuka dosen, berhenti begitu sudah absen atau kelas selesai.
  const afterClass = courseRange !== null && nowMinutes > courseRange[1] + 20;
  const nearSession = courseIsToday && (!courseRange || (nowMinutes >= courseRange[0] - 5 && nowMinutes <= courseRange[1] + 20));
  const alreadyPresent = serverPresent || Boolean(justPresent && activeCourse && justPresent === (activeCourse.id || activeCourse.kode || activeCourse.nama));
  const refreshMs = !courseIsToday || afterClass || alreadyPresent ? null : nearSession ? 6_000 : 30_000;

  const presenceApi = useApi<PresenceData>(
    token ? `/v1/elearning/presence?token=${token}` : "/v1/elearning/presence",
    { ttlMs: 2_000, refreshMs }
  );
  const pData = presenceApi.data;

  const updatedAt = presenceApi.updatedAt;
  useEffect(() => setServerPresent(Boolean(pData?.present_today)), [pData?.present_today]);

  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [liveNote, setLiveNote] = useState<string | null>(null);

  // Absen baru dibuka dosen saat halaman sedang terbuka: beri tahu langsung.
  const openNow =
    !pData?.present_today && (Boolean(pData?.can_submit) || Boolean(pData?.status_sesi?.toLowerCase().includes("absen masuk")));
  const wasOpen = useRef<boolean | null>(null);
  useEffect(() => {
    if (!pData) return;
    if (wasOpen.current === false && openNow) setLiveNote("Absen baru saja dibuka dosen. Segera absen sekarang.");
    if (!openNow) setLiveNote(null);
    wasOpen.current = openNow;
  }, [pData, openNow]);
  useEffect(() => {
    wasOpen.current = null;
    setLiveNote(null);
  }, [token]);

  async function handleSubmitPresence() {
    if (!token || !window.confirm(`Kirim presensi untuk ${activeCourse?.nama ?? "mata kuliah ini"} sekarang?`)) return;
    setSubmitting(true);
    setSubmitMessage(null);
    setSubmitError(null);
    try {
      const result = await apiFetch<{ success: boolean; message?: string }>(
        `/v1/elearning/presence?token=${token}`,
        { method: "POST" }
      );
      if (!result.success) throw new Error(result.message || "Presensi tidak berhasil dikirim.");
      clearApiCache("/v1/elearning/presence");
      setSubmitMessage(`Presensi ${activeCourse?.nama ?? "mata kuliah"} berhasil dicatat.`);
      setJustPresent(activeCourse ? (activeCourse.id || activeCourse.kode || activeCourse.nama) : null);
      presenceApi.reload();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Presensi gagal dikirim.");
    } finally {
      setSubmitting(false);
    }
  }

  if (coursesApi.loading) {
    return <LoadingState label="Memuat daftar mata kuliah presensi" />;
  }
  if (coursesApi.error) {
    return <ErrorState error={coursesApi.error} onRetry={coursesApi.reload} />;
  }

  if (courses.length === 0) {
    return (
      <div>
        <PageHeader title="Presensi Perkuliahan" />
        <EmptyState
          title="Belum ada mata kuliah aktif di MyBest."
          description="Pastikan KRS semester ini sudah terdaftar di MyBest."
        />
      </div>
    );
  }

  const records = pData?.riwayat ?? [];
  const isActiveSession =
    !pData?.present_today &&
    (Boolean(pData?.can_submit) || Boolean(pData?.status_sesi?.toLowerCase().includes("absen masuk")));
  const hadirCount = records.filter((r) => r.status_absen.toLowerCase() === "hadir").length;
  const totalPertemuan = records.length;
  const persentase = totalPertemuan > 0 ? Math.round((hadirCount / totalPertemuan) * 100) : 0;
  const dosen = resolveDosen(activeCourse, scheduleApi.data, pData?.dosen);
  const jam =
    pData?.jam_masuk && pData?.jam_keluar ? `${pData.jam_masuk} - ${pData.jam_keluar}` : activeCourse?.jam || "";
  const segments = 16;
  const filled = Math.round((persentase / 100) * segments);
  const courseKey = (c: CourseItem) => c.id || c.kode || c.nama;

  const sessionRange = minutesRange(pData?.jam_masuk, pData?.jam_keluar, activeCourse?.jam);
  const isTodaySession = (pData?.hari || activeCourse?.hari || "").toLowerCase().trim() === todayName.toLowerCase();
  const presentToday = Boolean(pData?.present_today) || (activeCourse !== null && justPresent === courseKey(activeCourse));
  let phase: Phase;
  if (presentToday) phase = "present";
  else if (isActiveSession) phase = "open";
  else if (!isTodaySession) phase = "off";
  else if (sessionRange && nowMinutes < sessionRange[0]) phase = "waiting";
  else if (sessionRange && nowMinutes > sessionRange[1]) phase = "ended";
  else phase = "live";
  const copy = PHASE_COPY[phase];
  const canAbsen = phase === "open";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Presensi Perkuliahan"
        description="Absen, riwayat kehadiran, dan rangkuman tiap pertemuan."
      />

      <CourseSelect
        options={courses.map((c) => ({
          key: courseKey(c),
          label: c.nama,
          sub: [c.hari, c.jam].filter(Boolean).join(" "),
          badge: c.hari?.toLowerCase().trim() === todayName.toLowerCase() ? "Hari Ini" : undefined,
        }))}
        value={activeCourse ? courseKey(activeCourse) : null}
        onChange={(key) => {
          setSelectedCourseKey(key);
          setOpenRecord(null);
          setSubmitMessage(null);
          setSubmitError(null);
        }}
      />

      {presenceApi.loading ? (
        <LoadingState label="Memuat rekap presensi..." />
      ) : presenceApi.error ? (
        <ErrorState error={presenceApi.error} onRetry={presenceApi.reload} />
      ) : (
        <div className="page-in space-y-6" key={activeCourse ? courseKey(activeCourse) : "none"}>
          {/* Kartu absen: status sesi + tombol utama */}
          <section
            className={`glass-card p-4 sm:p-6 ${phase === "open" || phase === "present" ? "[--px-line:#0F766E] [--px-drop:#99D5CC]" : ""}`}
            aria-labelledby="presensi-course-title"
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {(pData?.kode_mtk || activeCourse?.kode) && (
                    <span className="px-chip bg-px-tint px-2 py-0.5 font-mono text-[11px] font-bold text-[#0369A1]">
                      {pData?.kode_mtk || activeCourse?.kode}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                      phase === "open" || phase === "present" ? "bg-[#0F766E] text-white" : phase === "live" ? "bg-[#9A3412] text-white" : "bg-[#F0F7FB] text-secondary"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 ${phase === "open" || phase === "live" ? "px-cursor bg-white" : phase === "present" ? "bg-white" : "bg-secondary/60"}`} aria-hidden="true" />
                    {copy.chip}
                  </span>
                </div>
                <h2 id="presensi-course-title" className="text-lg font-display font-bold leading-snug text-foreground sm:text-xl">
                  {activeCourse?.nama || pData?.matakuliah}
                </h2>
                <dl className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-secondary">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" aria-hidden="true" />
                    <dt className="sr-only">Dosen</dt>
                    <dd className="min-w-0">
                      <DosenInfo
                        kode={dosen}
                        courses={courses
                          .filter((c) => resolveDosen(c, scheduleApi.data) === dosen)
                          .map((c) => ({ nama: c.nama, hari: c.hari, jam: c.jam }))}
                      />
                    </dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#0369A1]" aria-hidden="true" />
                    <dt className="sr-only">Ruang</dt>
                    <dd>
                      {pData?.ruang || activeCourse?.ruang || "-"}
                      {pData?.kelas ? ` · ${pData.kelas}` : ""}
                    </dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-[#0369A1]" aria-hidden="true" />
                    <dt className="sr-only">Jadwal</dt>
                    <dd>{[pData?.hari || activeCourse?.hari, jam].filter(Boolean).join(" ") || "-"}</dd>
                  </div>
                </dl>
              </div>

              <button
                type="button"
                onClick={handleSubmitPresence}
                disabled={!canAbsen || submitting || !token}
                className={`${canAbsen || phase === "present" ? "px-btn-success" : "px-btn"} inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 px-6 text-sm font-bold md:w-auto`}
              >
                {phase === "present" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <UserCheck className="h-4 w-4" aria-hidden="true" />}
                {submitting ? "Mengirim presensi..." : copy.button}
              </button>
            </div>

            {/* Rekap kehadiran */}
            {refreshMs && (
              <p className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-secondary">
                <span className="px-cursor h-1.5 w-1.5 shrink-0 bg-[#0F766E]" aria-hidden="true" />
                Diperbarui otomatis
                {updatedAt && <span className="normal-case tracking-normal">· {updatedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
              </p>
            )}

            <div className="mt-5 border-t-2 border-dashed border-px-soft pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-secondary">Kehadiran</span>
                <span className="font-mono text-xs text-secondary">
                  <strong className="font-mono text-lg text-[#0369A1]">{persentase}%</strong> · {hadirCount}/{totalPertemuan} hadir
                </span>
              </div>
              <div className="mt-2 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }} aria-hidden="true">
                {Array.from({ length: segments }, (_, i) => (
                  <span key={i} className={`h-2.5 ${i < filled ? (persentase >= 75 ? "bg-[#0F766E]" : "bg-[#9A3412]") : "bg-px-tint"}`} />
                ))}
              </div>
              {totalPertemuan > 0 && persentase < 75 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[#9A3412]">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Di bawah syarat minimal 75% untuk ikut ujian.
                </p>
              )}
            </div>
          </section>

          {liveNote && phase === "open" && (
            <div className="px-frame flex items-center gap-2 bg-[#F0FDF4] p-3 text-sm font-bold text-[#0F766E] [--px-line:#99D5CC]" role="status" aria-live="polite">
              <span className="px-cursor h-2 w-2 shrink-0 bg-[#0F766E]" aria-hidden="true" />
              {liveNote}
            </div>
          )}

          {(submitMessage || submitError) && (
            <div
              className={`px-frame break-words p-3 text-sm ${submitError ? "bg-[#FFF1F2] text-[#BE123C] [--px-line:#FDA4AF]" : "bg-[#F0FDF4] text-[#0F766E] [--px-line:#99D5CC]"}`}
              role="status"
            >
              {submitError || submitMessage}
            </div>
          )}

          {/* Riwayat pertemuan: satu baris per pertemuan, rangkuman bisa dibuka */}
          <section aria-labelledby="riwayat-title">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 id="riwayat-title" className="text-base font-display font-bold text-foreground">
                Riwayat Pertemuan
              </h3>
              <span className="font-mono text-xs text-secondary">{totalPertemuan} pertemuan tercatat</span>
            </div>

            {records.length === 0 ? (
              <EmptyState title="Belum ada riwayat presensi." description="Riwayat muncul setelah pertemuan pertama berlangsung." />
            ) : (
              <ol className="glass-card divide-y-2 divide-dashed divide-px-soft">
                {records.map((r) => {
                  const isHadir = r.status_absen.toLowerCase() === "hadir";
                  const summary = r.rangkuman?.trim() || "";
                  const bap = r.berita_acara?.trim() || "";
                  const hasDetail = Boolean(summary || bap);
                  const open = openRecord === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => hasDetail && setOpenRecord(open ? null : r.id)}
                        aria-expanded={hasDetail ? open : undefined}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5 ${hasDetail ? "transition-colors hover:bg-[#F0F7FB]" : "cursor-default"}`}
                      >
                        <span className="w-10 shrink-0 font-mono text-sm font-bold text-[#0369A1]">P-{r.pertemuan}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-xs text-secondary">{r.tanggal}</span>
                          {summary && !open && <span className="block truncate text-sm text-foreground">{notePreview(summary)}</span>}
                        </span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 px-2 py-0.5 text-[11px] font-bold ${
                            isHadir ? "bg-[#0F766E]/10 text-[#0F766E]" : "bg-[#BE123C]/10 text-[#BE123C]"
                          }`}
                        >
                          {isHadir ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <XCircle className="h-3 w-3" aria-hidden="true" />}
                          {r.status_absen}
                        </span>
                        {hasDetail && (
                          <ChevronDown className={`h-4 w-4 shrink-0 text-secondary transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                        )}
                      </button>
                      {open && (
                        <div className="page-in space-y-5 px-4 pb-5 pt-1 text-sm sm:px-5 sm:pl-[4.75rem]">
                          {summary && (
                            <div>
                              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">Rangkuman / Materi Dosen</p>
                              <FormattedNote text={summary} />
                            </div>
                          )}
                          {/* Berita acara sering sama dengan rangkuman; tampilkan hanya bila isinya berbeda. */}
                          {bap && !sameNote(bap, summary) && (
                            <div>
                              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">Berita Acara</p>
                              <FormattedNote text={bap} tone="muted" />
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
