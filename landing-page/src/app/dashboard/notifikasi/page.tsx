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
    label: "Tugas Baru & Kuis MyBest",
    desc: "Pengingat berkala kuis atau tugas kuliah yang belum dikerjakan.",
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
] as const;

const TYPE_CONFIG = {
  discord: {
    label: "Discord Webhook",
    placeholderUrl: "https://discord.com/api/webhooks/123456789/abcdef...",
    hint: "Buka Pengaturan Channel Discord > Integrations > Webhooks > Copy Webhook URL.",
  },
  telegram: {
    label: "Telegram Bot",
    hint: "Buat bot via @BotFather untuk token, dan kirim /start ke @userinfobot untuk Chat ID Anda.",
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

  async function handleSimulate(cat: "matkul-besok" | "quiz-tugas") {
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
      if (e.key === "Escape") setIsModalOpen(false);
    }
    if (isModalOpen) {
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
      await apiFetch("/v1/channels", { json: { type, categories, config } });
      clearApiCache("/v1/channels");
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

  async function handleTest(id: number) {
    setBusyId(id);
    setActionStatus((s) => ({ ...s, [id]: { ok: true, message: "Mengirim sinyal tes..." } }));
    try {
      const res = await apiFetch<{ message: string }>(`/v1/channels/${id}/test`, {
        method: "POST",
      });
      setActionStatus((s) => ({ ...s, [id]: { ok: true, message: res.message } }));
      clearApiCache("/v1/channels");
      reload();
    } catch (err) {
      setActionStatus((s) => ({
        ...s,
        [id]: {
          ok: false,
          message: err instanceof ApiError ? err.message : "Pengiriman pesan tes gagal.",
        },
      }));
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
          <div className="px-3.5 py-1.5 rounded-pill bg-[#0a1220] border border-[#92EEFF]/30 text-xs font-mono">
            <span className="text-secondary">Slot: </span>
            <span className={atLimit ? "text-amber-400 font-bold" : "text-[#92EEFF] font-bold"}>
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
              className="glass-card p-5 flex flex-col justify-between hover:border-[#92EEFF]/30 transition-all duration-200"
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
                    <div className="bg-[#050B14]/60 p-2 rounded-lg border border-white/5 font-mono truncate">
                      <span className="text-[#92EEFF] font-semibold">URL: </span>
                      <span className="text-foreground/80">{ch.config.url}</span>
                    </div>
                  )}
                  {ch.config.chat_id && (
                    <div className="bg-[#050B14]/60 p-2 rounded-lg border border-white/5 font-mono">
                      <span className="text-[#92EEFF] font-semibold">Chat ID: </span>
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
                          className="px-2 py-0.5 rounded-md bg-white/5 text-[11px] font-mono text-[#92EEFF] border border-white/10"
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
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
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

              <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleTest(ch.id)}
                  disabled={busyId === ch.id}
                  className={`${ghostButtonClass} text-xs py-1.5 px-3`}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  Kirim Tes
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(ch.id)}
                  disabled={busyId === ch.id}
                  className={`${ghostButtonClass} text-xs py-1.5 px-3 text-[#b42318] hover:border-[#fda4af] hover:bg-rose-500/10`}
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
                className={`${ghostButtonClass} text-xs py-1.5 px-3`}
              >
                <CalendarCheck className="h-3.5 w-3.5 text-[#92EEFF]" />
                {triggering === "matkul-besok" ? "Mengirim..." : "Tes Notif Matkul Besok"}
              </button>
              <button
                type="button"
                onClick={() => handleSimulate("quiz-tugas")}
                disabled={Boolean(triggering)}
                className={`${ghostButtonClass} text-xs py-1.5 px-3`}
              >
                <BookOpen className="h-3.5 w-3.5 text-[#92EEFF]" />
                {triggering === "quiz-tugas" ? "Mengirim..." : "Tes Notif Tugas & Kuis"}
              </button>
            </div>
          </div>

          {triggerStatus && (
            <div className="text-xs p-3 rounded-xl bg-white/5 border border-white/10 text-[#92EEFF] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{triggerStatus}</span>
            </div>
          )}
        </div>
      )}

      {/* POPUP MODAL TAMBAH WEBHOOK */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="glass-card-3d w-full max-w-xl p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto space-y-5 rounded-2xl shadow-2xl border border-[#92EEFF]/30"
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
                className="p-1 rounded-lg text-secondary hover:text-foreground hover:bg-white/10 transition-colors"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
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
                          ? "bg-[#0369A1]/30 border-[#92EEFF] text-[#92EEFF] shadow-sm"
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
                      <div
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          active
                            ? "bg-[#0369A1]/20 border-[#92EEFF]/60 text-foreground"
                            : "bg-white/5 border-white/10 text-secondary hover:bg-white/10"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => {}}
                          className="mt-1 rounded text-[#0369A1] focus:ring-[#92EEFF]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                            <Icon className="h-3.5 w-3.5 text-[#92EEFF]" />
                            <span>{cat.label}</span>
                          </div>
                          <p className="text-[11px] text-secondary mt-0.5 leading-relaxed">
                            {cat.desc}
                          </p>
                        </div>
                      </div>
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