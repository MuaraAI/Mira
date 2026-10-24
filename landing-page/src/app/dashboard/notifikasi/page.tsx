"use client";

import { useState, useEffect } from "react";
import {
  Send,
  Trash2,
  Plus,
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
import PwaPushDeviceSection from "@/components/PwaPushDeviceSection";
import { NOTIFICATION_CATEGORIES, type NotificationCategoryId } from "@/lib/notification-categories";
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
import { SideSheet } from "@/components/SideSheet";
import { useDialog } from "@/components/ConfirmDialog";

interface Channel {
  id: number;
  type: "discord" | "telegram" | "custom";
  categories: string[];
  config: { url?: string; bot_token?: string; chat_id?: string };
  is_active: boolean;
  created_at: string;
}

const MAX_CHANNELS = 5;

const CATEGORY_ICONS: Record<NotificationCategoryId, typeof Clock> = {
  "kelas-mulai": Clock,
  "absen-kuliah": CheckCircle2,
  "matkul-besok": CalendarCheck,
  "quiz-tugas": BookOpen,
  "tugas-baru": BookOpen,
  "berita-kampus": Bell,
  "pengumuman-siakad": GraduationCap,
  "nilai-keluar": Award,
  "jadwal-ujian": FileText,
};

const AVAILABLE_CATEGORIES = NOTIFICATION_CATEGORIES.map((cat) => ({ ...cat, icon: CATEGORY_ICONS[cat.id] }));

const TYPE_CONFIG = {
  discord: {
    label: "Discord Webhook",
    placeholderUrl: "https://discord.com/api/webhooks/123456789/abcdef...",
    hint: "Buka Pengaturan Channel Discord > Integrations > Webhooks > Copy Webhook URL.",
  },
  telegram: {
    label: "Telegram Bot",
    hint: "Buat bot via @BotFather, buka bot kamu lalu klik START, lalu ambil Chat ID via @userinfobot.",
  },
  custom: {
    label: "Custom HTTP Endpoint",
    placeholderUrl: "https://api.domain-anda.com/webhook",
    hint: "Server kamu akan menerima HTTP POST dengan payload JSON terstruktur.",
  },
} as const;

export default function NotifikasiPage() {
  const { confirm } = useDialog();
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

  async function handleSimulate(cat: NotificationCategoryId) {
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
  }, [isModalOpen, editingChannelId]);

  // Section push dirender SEBELUM early-return: kontrol cabut device tidak boleh
  // hilang hanya karena /v1/channels sedang error.
  const pushSection = <PwaPushDeviceSection />;
  const pageHeader = <PageHeader title="Notifikasi" description="Pengingat kelas, absen, dan tugas ke HP, Discord, atau Telegram." />;

  if (loading) return (<div className="space-y-6">{pageHeader}{pushSection}<LoadingState label="Memuat channel webhook notifikasi" /></div>);
  if (error) return (<div className="space-y-6">{pageHeader}{pushSection}<ErrorState error={error} onRetry={reload} /></div>);

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
    setEditCategories((current) => {
      if (current.includes(categoryId)) {
        return current.filter((category) => category !== categoryId);
      }
      if (current.length >= 5) {
        setFormError("Maksimal 5 kategori notifikasi per channel.");
        return current;
      }
      return [...current, categoryId];
    });
  }

  async function handleEditCategories(e: React.FormEvent) {
    e.preventDefault();
    if (!editingChannelId || editCategories.length === 0) {
      setFormError("Minimal pilih satu kategori event notifikasi.");
      return;
    }
    if (editCategories.length > 5) {
      setFormError("Maksimal 5 kategori notifikasi per channel.");
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
    const ok = await confirm({
      title: "Hapus channel notifikasi?",
      message: "Mira berhenti mengirim notifikasi ke channel ini. Kamu bisa menambahkannya lagi kapan saja.",
      confirmLabel: "Hapus",
      tone: "danger",
    });
    if (!ok) return;
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
      {pageHeader}
      {pushSection}

      <section aria-labelledby="webhook-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="webhook-title" className="font-display text-lg font-bold text-foreground">Discord dan Telegram</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-secondary">
              Pengingat yang sama juga bisa masuk ke channel Discord atau chat Telegram kamu.
            </p>
          </div>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <span className="px-chip whitespace-nowrap bg-[#F0F7FB] px-3 py-2 font-mono text-xs [--px-line:#CFE2EE]">
              <span className="text-secondary">Slot </span>
              <span className={atLimit ? "font-bold text-amber-800" : "font-bold text-[#0369A1]"}>
                {channels.length}/{MAX_CHANNELS}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setIsModalOpen(true);
              }}
              disabled={atLimit}
              className={`${primaryButtonClass} min-h-11 px-4 text-xs`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah
            </button>
          </div>
        </div>

        {channels.length === 0 ? (
          <div className="glass-card space-y-4 p-6 text-center sm:p-8">
            <EmptyState
              title="Belum ada channel terpasang."
              description="Hubungkan Discord webhook atau bot Telegram biar notifikasi kuliah masuk otomatis."
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {channels.map((ch) => (
              <div key={ch.id} className="glass-card flex min-w-0 flex-col justify-between p-4 sm:p-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <ChannelTypeBadge type={ch.type} />
                      <ChannelActiveBadge active={ch.is_active} />
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-secondary">#{ch.id}</span>
                  </div>

                  <div className="space-y-2 text-xs text-secondary">
                    {ch.config.url && (
                      <div className="break-all bg-[#F0F7FB] p-2.5 font-mono leading-relaxed line-clamp-2">
                        <span className="font-semibold text-[#0369A1]">URL </span>
                        <span className="text-foreground/80">{ch.config.url}</span>
                      </div>
                    )}
                    {ch.config.chat_id && (
                      <div className="bg-[#F0F7FB] p-2.5 font-mono">
                        <span className="font-semibold text-[#0369A1]">Chat ID </span>
                        <span className="text-foreground/80">{ch.config.chat_id}</span>
                      </div>
                    )}

                    <div className="pt-1">
                      <span className="mb-1.5 block font-semibold text-foreground">Yang dikirim</span>
                      <div className="flex flex-wrap gap-1.5">
                        {ch.categories.map((c) => (
                          <span key={c} className="bg-[#F0F7FB] px-2 py-1 font-mono text-[11px] text-[#0369A1]">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {actionStatus[ch.id]?.message && (
                    <div
                      role="status"
                      className={`flex items-start gap-1.5 p-2.5 text-xs ${
                        actionStatus[ch.id].ok ? "bg-[#F0FDF4] text-[#0F766E]" : "bg-[#FFF1F2] text-[#BE123C]"
                      }`}
                    >
                      {actionStatus[ch.id].ok ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0 break-words">{actionStatus[ch.id].message}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(5.25rem,1fr))] gap-2 border-t-2 border-dashed border-px-soft pt-4">
                  <button type="button" onClick={() => openEditCategories(ch)} disabled={busyId === ch.id} className={`${ghostButtonClass} min-h-11 px-3 text-xs`}>
                    <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                    Kategori
                  </button>
                  <button type="button" onClick={() => handleTest(ch.id)} disabled={busyId === ch.id} className={`${ghostButtonClass} min-h-11 px-3 text-xs`}>
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    Kirim tes
                  </button>
                  <button type="button" onClick={() => handleDelete(ch.id)} disabled={busyId === ch.id} className={`${ghostButtonClass} min-h-11 px-3 text-xs text-[#BE123C]`}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {channels.length > 0 && (
          <div className="glass-card space-y-4 p-4 sm:p-5">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">Coba kirim contoh</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-secondary">Lihat tampilan tiap jenis pengingat di channel kamu.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {SIMULATIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSimulate(id)}
                  disabled={Boolean(triggering)}
                  className={`${ghostButtonClass} min-h-11 px-3 text-xs`}
                >
                  <Icon className="h-3.5 w-3.5 text-[#0369A1]" aria-hidden="true" />
                  {triggering === id ? "Mengirim..." : label}
                </button>
              ))}
            </div>
            {triggerStatus && (
              <div role="status" className="flex items-start gap-2 bg-[#F0F7FB] p-3 text-xs text-[#0369A1]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <span className="min-w-0 break-words">{triggerStatus}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Ubah kategori channel: panel samping (desktop) atau dari bawah (HP) */}
      <SideSheet
        open={editingChannelId !== null}
        onClose={() => setEditingChannelId(null)}
        eyebrow="Channel"
        title="Ubah yang dikirim"
        subtitle="Tambah atau kurangi jenis notifikasi tanpa mengubah data channel."
        titleId="edit-category-title"
        width="md"
        footer={
          <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
            <button type="button" onClick={() => setEditingChannelId(null)} className={ghostButtonClass}>Batal</button>
            <button type="submit" form="edit-category-form" disabled={saving} className={primaryButtonClass}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        }
      >
        <form id="edit-category-form" onSubmit={handleEditCategories} className="space-y-4">
          {formError && <div className="bg-[#FFF1F2] p-3 text-xs text-[#BE123C]" role="alert">{formError}</div>}
          <CategoryPicker selected={editCategories} onToggle={toggleEditCategory} />
        </form>
      </SideSheet>

      {/* Tambah channel baru */}
      <SideSheet
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eyebrow="Channel baru"
        title="Hubungkan Discord atau Telegram"
        subtitle={`Slot terpakai ${channels.length} dari ${MAX_CHANNELS}.`}
        titleId="modal-title"
        width="md"
        footer={
          <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
            <button type="button" onClick={() => setIsModalOpen(false)} className={ghostButtonClass}>Batal</button>
            <button type="submit" form="add-channel-form" disabled={saving || atLimit} className={primaryButtonClass}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        }
      >
        <form id="add-channel-form" onSubmit={handleAdd} className="space-y-5">
          {formError && (
            <div className="flex items-start gap-2 bg-[#FFF1F2] p-3 text-xs text-[#BE123C]" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{formError}</span>
            </div>
          )}

          <fieldset>
            <legend className="mb-2 block text-xs font-bold uppercase tracking-wider text-foreground">Platform</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["discord", "telegram", "custom"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1.5 px-2 text-xs font-bold transition-colors ${
                    type === t
                      ? "bg-[#0369A1] text-white shadow-[2px_2px_0_0_#072033]"
                      : "bg-px-tint text-secondary hover:text-foreground"
                  }`}
                >
                  <Radio className="h-4 w-4" aria-hidden="true" />
                  <span>{t === "custom" ? "Endpoint" : TYPE_CONFIG[t].label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-secondary">{TYPE_CONFIG[type].hint}</p>
          </fieldset>

          {type === "telegram" ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="bot-token" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-foreground">Bot token</label>
                <input id="bot-token" type="text" required autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ" value={botToken} onChange={(e) => setBotToken(e.target.value)} className={`${inputClass} min-h-12 text-base sm:text-sm`} />
              </div>
              <div>
                <label htmlFor="chat-id" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-foreground">Chat ID</label>
                <input id="chat-id" type="text" inputMode="numeric" required placeholder="987654321" value={chatId} onChange={(e) => setChatId(e.target.value)} className={`${inputClass} min-h-12 text-base sm:text-sm`} />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="channel-url" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-foreground">
                {type === "discord" ? "Webhook URL Discord" : "URL endpoint (HTTPS)"}
              </label>
              <input id="channel-url" type="url" inputMode="url" required autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={TYPE_CONFIG[type].placeholderUrl} value={url} onChange={(e) => setUrl(e.target.value)} className={`${inputClass} min-h-12 text-base sm:text-sm`} />
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">Yang mau dikirim</p>
            <CategoryPicker selected={categories} onToggle={toggleCategory} />
          </div>
        </form>
      </SideSheet>
    </div>
  );
}

const SIMULATIONS: { id: NotificationCategoryId; label: string; icon: typeof Clock }[] = [
  { id: "matkul-besok", label: "Kuliah besok", icon: CalendarCheck },
  { id: "quiz-tugas", label: "Tugas dan kuis", icon: BookOpen },
  { id: "absen-kuliah", label: "Absen", icon: Clock },
  { id: "nilai-keluar", label: "Nilai", icon: Award },
  { id: "jadwal-ujian", label: "Jadwal ujian", icon: FileText },
];

/** Daftar jenis notifikasi dengan kotak centang (dipakai form tambah dan ubah channel). */
function CategoryPicker({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  return (
    <ul className="space-y-2.5">
      {AVAILABLE_CATEGORIES.map((cat) => {
        const on = selected.includes(cat.id);
        const Icon = cat.icon;
        return (
          <li key={cat.id}>
            <label
              className={`flex min-h-14 cursor-pointer items-start gap-3 p-3 transition-colors ${
                on ? "bg-px-highlight shadow-[inset_3px_0_0_#0369A1]" : "bg-white shadow-[0_-2px_0_0_#D9E5ED,0_2px_0_0_#D9E5ED,-2px_0_0_0_#D9E5ED,2px_0_0_0_#D9E5ED] hover:bg-[#F0F7FB]"
              }`}
            >
              <input type="checkbox" checked={on} onChange={() => onToggle(cat.id)} className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#0369A1]" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" aria-hidden="true" />
                  {cat.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-secondary">{cat.desc}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
