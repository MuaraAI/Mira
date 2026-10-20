"use client";

import { useState, useEffect } from "react";
import {
  Send,
  Trash2,
  Plus,
  X,
  Bell,
  CheckCircle2,
  AlertCircle,
  Radio,
  BookOpen,
  CalendarCheck,
  GraduationCap,
  Clock,
  Award,
  FileText,
} from "lucide-react";
import { apiFetch, ApiError, useApi, clearApiCache } from "@/lib/api";
import {
  ChannelActiveBadge,
  ChannelTypeBadge,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
} from "@/components/dashboard-ui";

interface Channel {
  id: number;
  type: "discord" | "telegram" | "custom";
  categories: string[];
  config: { url?: string; bot_token?: string; chat_id?: string };
  is_active: boolean;
  created_at: string;
}

const MAX_CHANNELS = 5;

const AVAILABLE_CATEGORIES = [
  {
    id: "matkul-besok",
    label: "Pengingat Kuliah H-1",
    desc: "Notifikasi otomatis jadwal matkul, ruang, jam, dan dosen esok hari.",
    icon: CalendarCheck,
  },
  {
    id: "quiz-tugas",
    label: "Tugas dan Kuis MyBest",
    desc: "Pengingat berkala kuis atau tugas kuliah yang belum dikerjakan.",
    icon: BookOpen,
  },
  {
    id: "tugas-baru",
    label: "Tugas Baru",
    desc: "Pemberitahuan saat tugas baru terdeteksi di MyBest.",
    icon: BookOpen,
  },
  {
    id: "berita-kampus",
    label: "Warta Berita Kampus",
    desc: "Broadcast otomatis setiap ada warta dan artikel baru di portal kampus.",
    icon: Bell,
  },
  {
    id: "pengumuman-siakad",
    label: "Pengumuman SIAKAD",
    desc: "Pemberitahuan akademik resmi dari sistem studentv2 kampus.",
    icon: GraduationCap,
  },
  {
    id: "absen-kuliah",
    label: "Presensi Kuliah Terbuka",
    desc: "Pemberitahuan saat sesi absensi pertemuan dibuka di MyBest.",
    icon: Clock,
  },
  {
    id: "nilai-keluar",
    label: "Rilis Nilai & KHS",
    desc: "Notifikasi otomatis saat nilai akhir atau KHS semester dipublikasikan.",
    icon: Award,
  },
  {
    id: "jadwal-ujian",
    label: "Jadwal & Ruang Ujian",
    desc: "Pengingat jadwal, ruang, dan unduhan soal ruang UTS / UAS.",
    icon: FileText,
  },
] as const;

const TYPE_CONFIG = {
  discord: {
    label: "Discord Webhook",
    placeholderUrl: "https://discord.com/api/webhooks/123456789/abcdef...",
    hint: "Buka Pengaturan Channel Discord > Integrations > Webhooks > Copy Webhook URL.",
  },
  telegram: {
    label: "Telegram Bot",
    hint: "Buat bot via @BotFather, buka bot Anda lalu klik START, lalu ambil Chat ID via @userinfobot.",
  },
  custom: {
    label: "Custom HTTP Endpoint",
    placeholderUrl: "https://api.domain-anda.com/webhook",
    hint: "Server Anda akan menerima HTTP POST dengan payload JSON terstruktur.",
  },
} as const;

export default function NotifikasiPage() {
  const { data, loading, error, reload } = useApi<{ channels: Channel[]; total: number }>(
    "/v1/channels"
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<number | null>(null);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [type, setType] = useState<Channel["type"]>("discord");
  const [url, setUrl] = useState("");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [categories, setCategories] = useState<string[]>([
    "matkul-besok",
    "quiz-tugas",
    "berita-kampus",
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState<
    Record<number, { ok: boolean; message: string }>
  >({});
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);

  async function handleSimulate(
    cat:
      | "matkul-besok"
      | "quiz-tugas"
      | "tugas-baru"
      | "pengumuman-siakad"
      | "absen-kuliah"
      | "nilai-keluar"
      | "jadwal-ujian"
  ) {
    setTriggering(cat);
    setTriggerStatus(null);
    try {
      const res = await apiFetch<{ message: string }>(
        "/v1/channels/trigger-reminder",
        { json: { category: cat } }
      );
      setTriggerStatus(res.message);
    } catch (err) {
      setTriggerStatus(
        err instanceof ApiError ? err.message : "Gagal mengirim simulasi pengingat."
      );
    } finally {
      setTriggering(null);
    }
  }

  // Close modal on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsModalOpen(false);
        setEditingChannelId(null);
      }
    }
    if (isModalOpen || editingChannelId !== null) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isModalOpen]);

  if (loading) return <LoadingState label="Memuat channel webhook notifikasi" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const channels = data?.channels ?? [];
  const atLimit = channels.length >= MAX_CHANNELS;

  function toggleCategory(catId: string) {
    setCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (categories.length === 0) {
      setFormError("Minimal pilih satu kategori event notifikasi.");
      return;
    }

    const config =
      type === "telegram"
        ? { bot_token: botToken.trim(), chat_id: chatId.trim() }
        : { url: url.trim() };

    setSaving(true);
    try {
      const created = await apiFetch<{ id: number }>("/v1/channels", { json: { type, categories, config } });
      clearApiCache("/v1/channels");
      if (created?.id) {
        await handleTest(created.id);
      }
      setUrl("");
      setBotToken("");
      setChatId("");
      setIsModalOpen(false);
      reload();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Gagal menambahkan webhook channel."
      );
    } finally {
      setSaving(false);
    }
  }

  function openEditCategories(channel: Channel) {
    setEditingChannelId(channel.id);
    setEditCategories([...channel.categories]);
    setFormError(null);
  }

  function toggleEditCategory(categoryId: string) {
    setEditCategories((current) =>
      current.includes(categoryId)
        ? current.filter((category) => category !== categoryId)
        : [...current, categoryId]
    );
  }

  async function handleEditCategories(e: React.FormEvent) {
    e.preventDefault();
    if (!editingChannelId || editCategories.length === 0) {
      setFormError("Minimal pilih satu kategori event notifikasi.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/v1/channels/${editingChannelId}`, {
        method: "PATCH",
        json: { categories: editCategories },
      });
      clearApiCache("/v1/channels");
      setEditingChannelId(null);
      setEditCategories([]);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal memperbarui kategori webhook.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Hapus channel notifikasi ini?")) return;
    setBusyId(id);
    setActionStatus((s) => ({ ...s, [id]: { ok: true, message: "" } }));
    try {
      await apiFetch(`/v1/channels/${id}`, { method: "DELETE" });
      clearApiCache("/v1/channels");
      reload();
    } catch (err) {
      setActionStatus((s) => ({
        ...s,
        [id]: {
          ok: false,
          message: err instanceof ApiError ? err.message : "Gagal menghapus channel.",
        },
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleTest(id: number): Promise<boolean> {
    setBusyId(id);
    setActionStatus((s) => ({ ...s, [id]: { ok: true, message: "Mengirim sinyal tes..." } }));
    try {
      const res = await apiFetch<{ message: string }>(`/v1/channels/${id}/test`, {
        method: "POST",
      });
      setActionStatus((s) => ({ ...s, [id]: { ok: true, message: res.message } }));
      clearApiCache("/v1/channels");
      reload();
      return true;
    } catch (err) {
      setActionStatus((s) => ({
        ...s,
        [id]: {
          ok: false,
          message: err instanceof ApiError ? err.message : "Pengiriman pesan tes gagal.",
        },
      }));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Webhook Notifikasi"
          description="Terima pengingat kuliah H-1, tugas baru, dan warta kampus langsung ke Discord atau Telegram pribadi."
        />

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-pill bg-[#F0F7FB] border border-[#D9E5ED] text-xs font-mono">
            <span className="text-secondary">Slot: </span>
            <span className={atLimit ? "text-amber-800 font-bold" : "text-[#0369A1] font-bold"}>
              {channels.length} / {MAX_CHANNELS}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setIsModalOpen(true);
            }}
            disabled={atLimit}
            className={`${primaryButtonClass} text-xs py-2 px-3.5`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah Webhook
          </button>
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="glass-card p-8 text-center space-y-4">
          <EmptyState
            title="Belum ada channel notifikasi terpasang."
            description="Hubungkan Discord webhook atau bot Telegram untuk menerima notifikasi kuliah otomatis."
          />
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setIsModalOpen(true);
            }}
            className={`${primaryButtonClass} mx-auto`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Hubungkan Webhook Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="glass-card p-5 flex flex-col justify-between hover:border-[#0369A1]/30 transition-all duration-200"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ChannelTypeBadge type={ch.type} />
                    <ChannelActiveBadge active={ch.is_active} />
                  </div>
                  <span className="text-[11px] font-mono text-secondary">ID #{ch.id}</span>
                </div>

                <div className="space-y-1.5 text-xs text-secondary">
                  {ch.config.url && (
                    <div className="bg-[#F0F7FB] p-2 rounded-lg border border-[#D9E5ED] font-mono truncate">
                      <span className="text-[#0369A1] font-semibold">URL: </span>
                      <span className="text-foreground/80">{ch.config.url}</span>
                    </div>
                  )}
                  {ch.config.chat_id && (
                    <div className="bg-[#F0F7FB] p-2 rounded-lg border border-[#D9E5ED] font-mono">
                      <span className="text-[#0369A1] font-semibold">Chat ID: </span>
                      <span className="text-foreground/80">{ch.config.chat_id}</span>
                    </div>
                  )}

                  <div className="pt-1">
                    <span className="text-foreground font-semibold block mb-1">
                      Event Notifikasi:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ch.categories.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 rounded-md bg-[#F0F7FB] text-[11px] font-mono text-[#0369A1] border border-[#D9E5ED]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {actionStatus[ch.id]?.message && (
                  <div
                    className={`text-xs p-2 rounded-lg flex items-center gap-1.5 ${
                      actionStatus[ch.id].ok
                        ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/25"
                        : "bg-rose-500/10 text-rose-800 border border-rose-500/25"
                    }`}
                  >
                    {actionStatus[ch.id].ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{actionStatus[ch.id].message}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-stroke flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openEditCategories(ch)}
                  disabled={busyId === ch.id}
                  className={`${ghostButtonClass} text-xs py-2.5 px-3 min-h-[44px]`}
                >
                  <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit Kategori
                </button>
                <button
                  type="button"
                  onClick={() => handleTest(ch.id)}
                  disabled={busyId === ch.id}
                  className={`${ghostButtonClass} text-xs py-2.5 px-3 min-h-[44px]`}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  Kirim Tes
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(ch.id)}
                  disabled={busyId === ch.id}
                  className={`${ghostButtonClass} text-xs py-2.5 px-3 min-h-[44px] text-[#BE123C] hover:border-[#BE123C]/40 hover:bg-rose-500/10`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* UJI COBA SIMULASI PENGINGAT OTOMATIS */}
      {channels.length > 0 && (
        <div className="glass-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-sm text-foreground">
                Simulasi Pengingat Webhook
              </h3>
              <p className="text-xs text-secondary mt-0.5 font-sans">
                Uji format tampilan pengingat matkul H-1 dan tugas kuis langsung ke channel aktif Anda.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSimulate("matkul-besok")}
                disabled={Boolean(triggering)}
                className={`${ghostButtonClass} text-xs py-2.5 px-3 min-h-[44px]`}
              >
                <CalendarCheck className="h-3.5 w-3.5 text-[#0369A1]" />
                {triggering === "matkul-besok" ? "Mengirim..." : "Tes Notif Matkul Besok"}
              </button>
              <button
                type="button"
                onClick={() => handleSimulate("quiz-tugas")}
                disabled={Boolean(triggering)}
                className={`${ghostButtonClass} text-xs py-2.5 px-3 min-h-[44px]`}
              >
                <BookOpen className="h-3.5 w-3.5 text-[#0369A1]" />
                {triggering === "quiz-tugas" ? "Mengirim..." : "Tes Tugas & Kuis"}
              </button>
              <button
                type="button"
                onClick={() => handleSimulate("absen-kuliah")}
                disabled={Boolean(triggering)}
                className={`${ghostButtonClass} text-xs py-2.5 px-3 min-h-[44px]`}
              >
                <Clock className="h-3.5 w-3.5 text-[#0369A1]" />
                {triggering === "absen-kuliah" ? "Mengirim..." : "Tes Presensi"}
              </button>
              <button
                type="button"
                onClick={() => handleSimulate("nilai-keluar")}
                disabled={Boolean(triggering)}
                className={`${ghostButtonClass} text-xs py-2.5 px-3 min-h-[44px]`}
              >
                <Award className="h-3.5 w-3.5 text-[#0369A1]" />
                {triggering === "nilai-keluar" ? "Mengirim..." : "Tes Nilai"}
              </button>
              <button
                type="button"
                onClick={() => handleSimulate("jadwal-ujian")}
                disabled={Boolean(triggering)}
                className={`${ghostButtonClass} text-xs py-2.5 px-3 min-h-[44px]`}
              >
                <FileText className="h-3.5 w-3.5 text-[#0369A1]" />
                {triggering === "jadwal-ujian" ? "Mengirim..." : "Tes Ujian"}
              </button>
            </div>
          </div>

          {triggerStatus && (
            <div className="text-xs p-3 rounded-xl bg-[#F0F7FB] border border-[#D9E5ED] text-[#0369A1] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>{triggerStatus}</span>
            </div>
          )}
        </div>
      )}

      {editingChannelId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="glass-card-3d w-full max-w-xl p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto space-y-5 rounded-2xl shadow-2xl border border-[#0369A1]/30" role="dialog" aria-modal="true" aria-labelledby="edit-category-title">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 id="edit-category-title" className="text-lg font-display font-bold text-foreground">Edit Kategori Webhook</h2>
                <p className="text-xs text-secondary mt-0.5">Tambah atau hapus jenis notifikasi tanpa mengubah kredensial channel.</p>
              </div>
              <button type="button" onClick={() => setEditingChannelId(null)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-secondary hover:text-foreground hover:bg-[#F0F7FB]" aria-label="Tutup edit kategori"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleEditCategories} className="space-y-4">
              {formError && <div className="p-3 rounded-lg bg-[#F0F7FB] border border-[#BE123C]/30 text-[#BE123C] text-xs"><span>{formError}</span></div>}
              <div className="space-y-2">
                {AVAILABLE_CATEGORIES.map((cat) => {
                  const active = editCategories.includes(cat.id);
                  const Icon = cat.icon;
                  return <button key={cat.id} type="button" onClick={() => toggleEditCategory(cat.id)} className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${active ? "bg-[#0369A1]/20 border-[#0369A1]/60" : "bg-white/5 border-white/10 hover:bg-white/10"}`} aria-pressed={active}>
                    <span className={`mt-0.5 h-4 w-4 rounded border ${active ? "bg-[#0369A1] border-[#0369A1]" : "border-[#9FB4C2]"}`} aria-hidden="true" />
                    <span className="flex-1"><span className="flex items-center gap-1.5 font-semibold text-xs text-foreground"><Icon className="h-3.5 w-3.5 text-[#0369A1]" />{cat.label}</span><span className="block text-[11px] text-secondary mt-0.5">{cat.desc}</span></span>
                  </button>;
                })}
              </div>
              <div className="pt-3 border-t border-white/10 flex justify-end gap-3"><button type="button" onClick={() => setEditingChannelId(null)} className={ghostButtonClass}>Batal</button><button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Menyimpan..." : "Simpan Kategori"}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL TAMBAH WEBHOOK */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="glass-card-3d w-full max-w-xl p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto space-y-5 rounded-2xl shadow-2xl border border-[#0369A1]/30"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 id="modal-title" className="text-lg font-display font-bold text-foreground">
                  Hubungkan Webhook Baru
                </h2>
                <p className="text-xs text-secondary mt-0.5">
                  Slot terpakai {channels.length} dari maksimal {MAX_CHANNELS} channel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-secondary hover:text-foreground hover:bg-[#F0F7FB] transition-colors"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-[#F0F7FB] border border-[#BE123C]/30 text-[#BE123C] text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* TIPE PLATFORM */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  Pilih Platform
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["discord", "telegram", "custom"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                        type === t
                          ? "bg-[#0369A1]/30 border-[#0369A1] text-[#0369A1] shadow-sm"
                          : "bg-white/5 border-white/10 text-secondary hover:bg-white/10"
                      }`}
                    >
                      <Radio className="h-4 w-4" />
                      <span>{TYPE_CONFIG[t].label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-secondary/80 font-sans">
                  {TYPE_CONFIG[type].hint}
                </p>
              </div>

              {/* CONFIG INPUTS */}
              {type === "telegram" ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Telegram Bot Token
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Chat ID Penerima
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 987654321"
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {type === "discord" ? "Discord Webhook URL" : "Endpoint URL (HTTPS)"}
                  </label>
                  <input
                    type="url"
                    required
                    placeholder={TYPE_CONFIG[type].placeholderUrl}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}

              {/* KATEGORI EVENT NOTIFIKASI */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  Event yang Ingin Diterima
                </label>
                <div className="space-y-2">
                  {AVAILABLE_CATEGORIES.map((cat) => {
                    const active = categories.includes(cat.id);
                    const Icon = cat.icon;
                    return (
                      <label
                        key={cat.id}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          active
                            ? "bg-[#0369A1]/20 border-[#0369A1]/60 text-foreground"
                            : "bg-[#F7FAFC] border-stroke text-secondary hover:bg-[#F0F7FB]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleCategory(cat.id)}
                          className="mt-1 rounded text-[#0369A1] focus:ring-[#0369A1]"
                        />
                        <span className="flex-1">
                          <span className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                            <Icon className="h-3.5 w-3.5 text-[#0369A1]" />
                            <span>{cat.label}</span>
                          </span>
                          <span className="block text-[11px] text-secondary mt-0.5 leading-relaxed">
                            {cat.desc}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={ghostButtonClass}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || atLimit}
                  className={primaryButtonClass}
                >
                  {saving ? "Menyimpan..." : "Simpan Channel Webhook"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}