"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  UserCheck,
  Clock,
  Building2,
  Wifi,
  MapPin,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  CalendarDays,
  Repeat,
} from "lucide-react";
import { apiFetch, useApi, clearApiCache } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from "@/components/dashboard-ui";
import {
  dateTiming,
  dayIndex,
  dayName,
  parseIsoDate,
  describeRoom,
  formatRecordDate,
  minutesRange,
  sessionTiming,
  shortDate,
  timingRank,
  type RoomInfo,
  type SessionTiming,
} from "@/lib/schedule";
import { CourseSelect } from "@/components/CourseSelect";
import { resolveDosen } from "@/lib/courses";
import { DosenInfo } from "@/components/DosenInfo";
import { FormattedNote } from "@/components/FormattedNote";
import { notePreview, sameNote } from "@/lib/notes";
import { useDialog } from "@/components/ConfirmDialog";

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

/** Kuliah pengganti terdaftar di MyBest (/v1/elearning/makeups). */
interface MakeupItem {
  id: string;
  kode?: string;
  mata_kuliah?: string;
  jadwal?: string;
  tanggal?: string | null;
  hari?: string | null;
  jam?: string | null;
  ruang?: string | null;
  dosen?: string | null;
  keterangan?: string;
  token_absen?: string | null;
  absen_path?: string | null;
}

interface TimedCourse {
  course: CourseItem;
  timing: SessionTiming | null;
  /** Diisi bila pertemuan terdekat mapel ini adalah kuliah pengganti. */
  makeup: MakeupItem | null;
}

const normText = (v?: string | null) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

function makeupMatches(course: CourseItem, m: MakeupItem): boolean {
  const kode = normText(m.kode);
  if (kode && kode !== "-" && (normText(course.kode) === kode || normText(course.kode_mtk) === kode)) return true;
  const a = normText(course.nama);
  const b = normText(m.mata_kuliah);
  return Boolean(a && b && b !== "-" && (a === b || a.includes(b) || b.includes(a)));
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

const PHASE_COPY: Record<Phase, { chip: string; button: string }> = {
  present: { chip: "Sudah Absen", button: "Sudah absen hari ini" },
  open: { chip: "Absen Dibuka", button: "Absen Sekarang" },
  waiting: { chip: "Belum Dimulai", button: "Belum waktunya absen" },
  live: { chip: "Menunggu Dosen", button: "Menunggu dosen membuka absen" },
  ended: { chip: "Kelas Selesai", button: "Sesi absen sudah selesai" },
  off: { chip: "Bukan Hari Kuliah", button: "Tidak ada kelas hari ini" },
};

/** Mata kuliah tersimpan di perangkat 12 jam (jadwal jarang berubah); presensi 10 menit untuk tampilan instan. */
const COURSES_PERSIST_MS = 12 * 60 * 60 * 1000;
const PRESENCE_PERSIST_MS = 10 * 60 * 1000;
const MAKEUP_PERSIST_MS = 30 * 60 * 1000;

function RoomBadge({ info }: { info: RoomInfo }) {
  const Icon = info.mode === "online" ? Wifi : info.mode === "offline" ? Building2 : MapPin;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold ${
        info.mode === "online" ? "bg-[#0369A1]/10 text-[#0369A1]" : info.mode === "offline" ? "bg-[#0F766E]/10 text-[#0F766E]" : "bg-px-tint text-secondary"
      }`}
      title={info.code ? `Kode ruang: ${info.code}` : undefined}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {info.label}
    </span>
  );
}

function PresenceSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat presensi">
      <div className="glass-card space-y-3 p-4 sm:p-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-12 w-full md:w-48" />
      </div>
      <div className="glass-card space-y-3 p-4 sm:p-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function PresensiPage() {
  const { confirm } = useDialog();
  const coursesApi = useApi<CourseItem[]>("/v1/elearning/courses", { persistMs: COURSES_PERSIST_MS });
  // Cadangan kode dosen dari jadwal SIAKAD.
  const scheduleApi = useApi<{ kode: string; nama: string; kode_dosen?: string; hari?: string; jam?: string; ruang?: string }[]>(
    "/v1/studentv2/schedule",
    { persistMs: COURSES_PERSIST_MS }
  );
  const makeupsApi = useApi<MakeupItem[]>("/v1/elearning/makeups", { persistMs: MAKEUP_PERSIST_MS });
  const [openRecord, setOpenRecord] = useState<string | null>(null);
  const [selectedCourseKey, setSelectedCourseKey] = useState<string | null>(null);

  // Jam berjalan untuk status sesi dan label "dimulai X menit lagi"; diperbarui tiap 30 detik.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const todayIdx = now.getDay();

  const rawCourses = coursesApi.data ?? [];
  const makeups = makeupsApi.data ?? [];
  const schedule = scheduleApi.data ?? [];
  // Presensi hari ini selalu di depan (berlangsung > segera > nanti > sudah selesai), baru hari berikutnya.
  // Kuliah pengganti dihitung per TANGGAL: pengganti hari ini mengalahkan jadwal reguler besok.
  const timed = useMemo<TimedCourse[]>(() => {
    const matched = new Set<string>();
    const entries: TimedCourse[] = rawCourses.map((course) => {
      // Hari/jam MyBest kadang kosong: pakai jadwal SIAKAD mapel yang sama sebagai cadangan.
      let { hari, jam } = course;
      if (dayIndex(hari) === null) {
        const k = normText(course.kode_mtk || course.kode);
        const s = schedule.find((x) => (k && normText(x.kode) === k) || normText(x.nama) === normText(course.nama));
        if (s) {
          hari = s.hari || hari;
          jam = jam || s.jam;
        }
      }
      const base = hari === course.hari && jam === course.jam ? course : { ...course, hari, jam };
      let best: TimedCourse = { course: base, timing: sessionTiming(hari, jam, now), makeup: null };
      for (const m of makeups) {
        if (!makeupMatches(course, m)) continue;
        matched.add(m.id);
        const date = parseIsoDate(m.tanggal);
        const t = date ? dateTiming(date, m.jam, now) : null;
        if (t && (best.timing === null || timingRank(t) < timingRank(best.timing))) best = { ...best, timing: t, makeup: m };
      }
      return best;
    });
    // Kuliah pengganti yang tidak cocok dengan mapel mana pun tetap bisa dipilih bila tanggalnya belum lewat.
    for (const m of makeups) {
      if (matched.has(m.id)) continue;
      const date = parseIsoDate(m.tanggal);
      const t = date ? dateTiming(date, m.jam, now) : null;
      if (!t) continue;
      entries.push({
        course: {
          id: `pengganti-${m.id}`,
          kode: m.kode && m.kode !== "-" ? m.kode : undefined,
          nama: m.mata_kuliah && m.mata_kuliah !== "-" ? m.mata_kuliah : "Kuliah Pengganti",
          hari: m.hari ?? undefined,
          jam: m.jam ?? undefined,
          ruang: m.ruang ?? undefined,
          kode_dosen: m.dosen ?? undefined,
          token_absen: m.token_absen,
        },
        timing: t,
        makeup: m,
      });
    }
    return entries.sort((a, b) => timingRank(a.timing) - timingRank(b.timing));
    // Urutan cukup dihitung ulang per menit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawCourses, makeups, schedule, Math.floor(now.getTime() / 60_000)]);
  const courses = useMemo(() => timed.map((t) => t.course), [timed]);
  const entryOf = (course: CourseItem | null): TimedCourse | null => (course ? timed.find((t) => t.course === course) ?? null : null);
  const timingOf = (course: CourseItem | null): SessionTiming | null => entryOf(course)?.timing ?? null;

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

  // Tanpa pilihan manual: otomatis mapel yang sedang/akan berlangsung paling dekat.
  const activeCourse = useMemo(() => {
    if (selectedCourseKey) {
      return courses.find((c) => (c.id || c.kode || c.nama) === selectedCourseKey) || courses[0] || null;
    }
    return courses[0] || null;
  }, [courses, selectedCourseKey]);
  const activeTiming = timingOf(activeCourse);
  const activeMakeup = entryOf(activeCourse)?.makeup ?? null;

  // Absen pengganti: pakai link absen dari halaman Kuliah Pengganti bila ada, selain itu token mapel reguler.
  const makeupToken = activeMakeup?.token_absen || null;
  const token = makeupToken || activeCourse?.token_absen;
  const absenPath = makeupToken && activeMakeup?.absen_path ? activeMakeup.absen_path : "absen-mhs";
  const absenQuery = token ? `token=${token}${absenPath !== "absen-mhs" ? `&path=${encodeURIComponent(absenPath)}` : ""}` : "";

  // Kunci mata kuliah yang baru saja diabsen; menjaga tampilan "sudah absen" sampai rekap MyBest ikut terbarui.
  const [justPresent, setJustPresent] = useState<string | null>(null);
  const [serverPresent, setServerPresent] = useState(false);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const alreadyPresent = serverPresent || Boolean(justPresent && activeCourse && justPresent === (activeCourse.id || activeCourse.kode || activeCourse.nama));
  // Polling hanya saat menunggu dosen membuka absen (menjelang/selama kelas hari ini). Di luar itu tidak
  // ada pembaruan otomatis, jadi tampilan tidak berubah-ubah sendiri.
  const watching = !alreadyPresent && (activeTiming?.state === "soon" || activeTiming?.state === "live");
  const refreshMs = watching ? 15_000 : null;

  // Tunggu daftar mapel dulu: tanpa token, backend akan men-scrape ulang daftar mapel + mapel pertama (lambat & sia-sia).
  const presencePath = activeCourse ? (token ? `/v1/elearning/presence?${absenQuery}` : "/v1/elearning/presence") : "";
  const presenceApi = useApi<PresenceData>(presencePath, { ttlMs: 5_000, refreshMs, persistMs: PRESENCE_PERSIST_MS });
  const pData = presenceApi.data;

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
    if (!token) return;
    const ok = await confirm({
      title: activeMakeup ? "Kirim absen kuliah pengganti?" : "Kirim presensi sekarang?",
      message: `Kehadiranmu untuk ${activeCourse?.nama ?? "mata kuliah ini"}${activeMakeup ? " (kuliah pengganti)" : ""} akan dicatat di MyBest.`,
      confirmLabel: "Kirim presensi",
    });
    if (!ok) return;
    setSubmitting(true);
    setSubmitMessage(null);
    setSubmitError(null);
    try {
      const result = await apiFetch<{ success: boolean; message?: string }>(
        `/v1/elearning/presence?${absenQuery}`,
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
    return (
      <div className="space-y-6">
        <PageHeader title="Presensi Perkuliahan" description="Absen, riwayat kehadiran, dan rangkuman tiap pertemuan." />
        <PresenceSkeleton />
      </div>
    );
  }
  if (coursesApi.error) {
    return <ErrorState error={coursesApi.error} onRetry={coursesApi.reload} />;
  }

  if (courses.length === 0) {
    return (
      <div>
        <PageHeader title="Presensi Perkuliahan" />
        <EmptyState
          mascot="/maskot/mura-presensi.png"
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
  const jam = activeMakeup?.jam
    ? activeMakeup.jam
    : pData?.jam_masuk && pData?.jam_keluar
      ? `${pData.jam_masuk} - ${pData.jam_keluar}`
      : activeCourse?.jam || "";
  const segments = 16;
  const filled = Math.round((persentase / 100) * segments);
  const courseKey = (c: CourseItem) => c.id || c.kode || c.nama;

  // Kuliah pengganti memakai tanggal/jam/ruang penggantinya, bukan jadwal reguler di halaman absen.
  const sessionRange = activeMakeup
    ? minutesRange(null, null, activeMakeup.jam) ?? minutesRange(pData?.jam_masuk, pData?.jam_keluar, activeCourse?.jam)
    : minutesRange(pData?.jam_masuk, pData?.jam_keluar, activeCourse?.jam);
  const isTodaySession = activeMakeup
    ? activeTiming?.daysAway === 0
    : dayIndex(pData?.hari || activeCourse?.hari) === todayIdx || activeTiming?.daysAway === 0;
  const room = describeRoom(activeMakeup?.ruang || pData?.ruang || activeCourse?.ruang);
  const scheduleDay = dayName(activeMakeup?.hari || pData?.hari || activeCourse?.hari);
  const nextDate = activeTiming ? activeTiming.date : null;
  const presentToday = Boolean(pData?.present_today) || (activeCourse !== null && justPresent === courseKey(activeCourse));
  let phase: Phase;
  if (presentToday) phase = "present";
  else if (isActiveSession) phase = "open";
  else if (!isTodaySession) phase = "off";
  else if (sessionRange && nowMinutes < sessionRange[0]) phase = "waiting";
  else if (sessionRange && nowMinutes > sessionRange[1]) phase = "ended";
  else phase = "live";
  const nextDay =
    activeTiming?.daysAway === 1
      ? "besok"
      : activeMakeup && nextDate
        ? shortDate(nextDate)
        : scheduleDay
          ? `hari ${scheduleDay}`
          : "sesuai jadwal";
  const copy =
    phase === "off"
      ? { chip: activeTiming?.daysAway === 1 ? "Besok" : scheduleDay ? `Jadwal ${scheduleDay}` : PHASE_COPY.off.chip, button: `Absen dibuka ${nextDay}` }
      : phase === "ended" && activeTiming
        ? { chip: PHASE_COPY.ended.chip, button: "Kelas hari ini sudah selesai" }
        : PHASE_COPY[phase];
  const canAbsen = phase === "open";

  // Semua kuliah pengganti yang belum lewat, urut tanggal; dipetakan ke mapel agar absennya bisa langsung dibuka.
  const upcomingMakeups = makeups
    .map((m) => {
      const date = parseIsoDate(m.tanggal);
      const t = date ? dateTiming(date, m.jam, now) : null;
      const c = timed.find((e) => e.makeup?.id === m.id)?.course || courses.find((rc) => makeupMatches(rc, m)) || null;
      return t ? { makeup: m, timing: t, course: c } : null;
    })
    .filter((x): x is { makeup: MakeupItem; timing: SessionTiming; course: CourseItem | null } => x !== null)
    .sort((a, b) => a.timing.date.getTime() - b.timing.date.getTime() || (a.timing.range?.[0] ?? 0) - (b.timing.range?.[0] ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Presensi Perkuliahan"
        description="Absen, riwayat kehadiran, dan rangkuman tiap pertemuan."
      />

      <CourseSelect
        options={courses.map((c) => {
          const t = timingOf(c);
          return {
            key: courseKey(c),
            label: c.nama,
            sub: [dayName(c.hari), c.jam, describeRoom(c.ruang).mode === "online" ? "Online" : describeRoom(c.ruang).mode === "offline" ? `R. ${c.ruang}` : ""]
              .filter(Boolean)
              .join(" · "),
            badge: (() => {
              const base = t?.state === "live" ? "Berlangsung" : t?.state === "soon" ? "Segera" : t?.daysAway === 0 ? "Hari Ini" : t?.daysAway === 1 ? "Besok" : undefined;
              return entryOf(c)?.makeup ? (base ? `Pengganti · ${base}` : "Pengganti") : base;
            })(),
          };
        })}
        value={activeCourse ? courseKey(activeCourse) : null}
        onChange={(key) => {
          setSelectedCourseKey(key);
          setOpenRecord(null);
          setSubmitMessage(null);
          setSubmitError(null);
        }}
      />

      {presenceApi.loading ? (
        <PresenceSkeleton />
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
                  {activeMakeup && (
                    <span className="inline-flex items-center gap-1.5 bg-[#7C3AED]/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#6D28D9]">
                      <Repeat className="h-3 w-3" aria-hidden="true" />
                      Kuliah Pengganti
                    </span>
                  )}
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
                  {pData?.kelas && (
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Kelas</dt>
                      <dd className="font-mono">{pData.kelas}</dd>
                    </div>
                  )}
                </dl>
                {/* Jadwal yang jelas: hari & tanggal pertemuan berikutnya, jam, status waktu, dan jenis ruang. */}
                <div className="space-y-2 pt-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
                    <CalendarDays className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
                    <span className="font-semibold">
                      {nextDate ? shortDate(nextDate) : scheduleDay || "-"}
                    </span>
                    {jam && (
                      <span className="inline-flex items-center gap-1 font-mono text-[13px] text-secondary">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {jam.replace(/\s*-\s*/, " - ")}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <RoomBadge info={room} />
                    {activeMakeup?.keterangan && (
                      <span className="inline-flex items-center gap-1.5 bg-px-tint px-2 py-0.5 text-xs text-secondary">{activeMakeup.keterangan}</span>
                    )}
                    {activeTiming && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold ${
                          activeTiming.state === "live"
                            ? "bg-[#9A3412]/10 text-[#9A3412]"
                            : activeTiming.state === "soon"
                              ? "bg-[#0369A1]/10 text-[#0369A1]"
                              : "bg-px-tint text-secondary"
                        }`}
                      >
                        {(activeTiming.state === "live" || activeTiming.state === "soon") && (
                          <span className="px-cursor h-1.5 w-1.5 bg-current" aria-hidden="true" />
                        )}
                        {activeTiming.label}
                      </span>
                    )}
                  </div>
                </div>
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
            {refreshMs && (phase === "live" || phase === "waiting") && (
              <p className="mt-4 flex items-center gap-2 text-xs text-secondary">
                <span className="h-1.5 w-1.5 shrink-0 bg-[#0F766E]" aria-hidden="true" />
                Memantau sesi absen. Tombol aktif otomatis saat dosen membuka absen.
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

          {upcomingMakeups.length > 0 && (
            <section aria-labelledby="pengganti-title">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id="pengganti-title" className="flex items-center gap-2 text-base font-display font-bold text-foreground">
                  <Repeat className="h-4 w-4 text-[#6D28D9]" aria-hidden="true" />
                  Jadwal Kuliah Pengganti
                </h3>
                <span className="font-mono text-xs text-secondary">{upcomingMakeups.length} terjadwal</span>
              </div>
              <ol className="glass-card divide-y-2 divide-dashed divide-px-soft">
                {upcomingMakeups.map(({ makeup: m, timing: t, course: c }) => {
                  const selected = activeMakeup?.id === m.id;
                  return (
                    <li key={m.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-bold text-foreground">{c?.nama || m.mata_kuliah}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
                          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                            <CalendarDays className="h-3.5 w-3.5 text-[#0369A1]" aria-hidden="true" />
                            {shortDate(t.date)}
                          </span>
                          {m.jam && (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              {m.jam.replace(/\s*-\s*/, " - ")}
                            </span>
                          )}
                          {m.ruang && <RoomBadge info={describeRoom(m.ruang)} />}
                          <span className={t.state === "live" || t.state === "soon" ? "font-semibold text-[#9A3412]" : ""}>{t.label}</span>
                        </div>
                        {m.keterangan && <p className="text-xs text-secondary">{m.keterangan}</p>}
                      </div>
                      {c && (
                        <button
                          type="button"
                          disabled={selected}
                          onClick={() => {
                            setSelectedCourseKey(courseKey(c));
                            setOpenRecord(null);
                            setSubmitMessage(null);
                            setSubmitError(null);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="px-btn inline-flex min-h-10 shrink-0 items-center justify-center gap-2 px-4 text-xs font-bold"
                        >
                          <UserCheck className="h-4 w-4" aria-hidden="true" />
                          {selected ? "Sedang dibuka" : "Buka absen pengganti"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
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
                          <span className="block text-xs font-medium text-secondary">{formatRecordDate(r.tanggal)}</span>
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
