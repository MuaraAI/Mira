"use client";

import { useState } from "react";
import { Send, Trash2, Plus } from "lucide-react";
import { apiFetch, ApiError, useApi } from "@/lib/api";
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
const CATEGORIES = ["berita-kampus", "tugas-baru", "pengumuman-siakad"] as const;
const TYPE_LABEL: Record<Channel["type"], string> = {
  discord: "Discord Webhook",
  telegram: "Telegram Bot",
  custom: "Custom Webhook",
};

export default function NotifikasiPage() {
  const { data, loading, error, reload } = useApi<{ channels: Channel[]; total: number }>(
    "/v1/channels"
  );

  const [type, setType] = useState<Channel["type"]>("discord");
  const [url, setUrl] = useState("");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [categories, setCategories] = useState<string[]>(["berita-kampus"]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState<Record<number, { ok: boolean; message: string }>>({});

  if (loading) return <LoadingState label="Memuat channel notifikasi" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const channels = data?.channels ?? [];
  const atLimit = channels.length >= MAX_CHANNELS;

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (categories.length === 0) {
      setFormError("Minimal pilih satu kategori notifikasi.");
      return;
    }
    const config =
      type === "telegram" ? { bot_token: botToken, chat_id: chatId } : { url };
    setSaving(true);
    try {
      await apiFetch("/v1/channels", { json: { type, categories, config } });
      setUrl("");
      setBotToken("");
      setChatId("");
      reload();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Gagal menambahkan channel. Coba lagi."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setBusyId(id);
    setActionStatus((s) => ({ ...s, [id]: { ok: true, message: "" } }));
    try {
      await apiFetch(`/v1/channels/${id}`, { method: "DELETE" });
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
    setActionStatus((s) => ({ ...s, [id]: { ok: true, message: "Mengirim pesan tes" } }));
    try {
      const res = await apiFetch<{ message: string }>(`/v1/channels/${id}/test`, {
        method: "POST",
      });
      setActionStatus((s) => ({ ...s, [id]: { ok: true, message: res.message } }));
      reload();
    } catch (err) {
      setActionStatus((s) => ({
        ...s,
        [id]: {
          ok: false,
          message: err instanceof ApiError ? err.message : "Pengiriman tes gagal.",
        },
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifikasi"
        description={`Terima notifikasi kampus langsung ke Discord, Telegram, atau webhook lain. Maksimal ${MAX_CHANNELS} channel per NIM.`}
      />

      <p className="mb-4 text-sm font-semibold text-secondary">
        {channels.length}/{MAX_CHANNELS} channel terpakai
      </p>

      {channels.length === 0 ? (
        <div className="mb-8">
          <EmptyState
            title="Belum ada channel notifikasi."
            description="Tambahkan channel pertama Anda lewat formulir di bawah, lalu kirim pesan tes untuk mengaktifkannya."
          />
        </div>
      ) : (
        <ul className="grid gap-4 mb-8">
          {channels.map((ch) => (
            <li key={ch.id} className="glass-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <ChannelTypeBadge type={ch.type} />
                <ChannelActiveBadge active={ch.is_active} />
                <span className="text-xs text-secondary">{TYPE_LABEL[ch.type]}</span>
              </div>

              <dl className="mt-3 space-y-1 text-sm text-secondary break-all">
                {ch.config.url && (
                  <div>
                    <dt className="inline font-semibold text-foreground">URL: </dt>
                    <dd className="inline font-mono text-xs">{ch.config.url}</dd>
                  </div>
                )}
                {ch.config.chat_id && (
                  <div>
                    <dt className="inline font-semibold text-foreground">Chat ID: </dt>
                    <dd className="inline font-mono text-xs">{ch.config.chat_id}</dd>
                  </div>
                )}
                <div>
                  <dt className="inline font-semibold text-foreground">Kategori: </dt>
                  <dd className="inline">{ch.categories.join(", ")}</dd>
                </div>
              </dl>

              {actionStatus[ch.id]?.message && (
                <p
                  className={`mt-3 text-sm ${actionStatus[ch.id].ok ? "text-[#08738a]" : "text-[#b42318]"}`}
                  role="status"
                >
                  {actionStatus[ch.id].message}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleTest(ch.id)}
                  disabled={busyId === ch.id}
                  className={ghostButtonClass}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Kirim Tes
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(ch.id)}
                  disabled={busyId === ch.id}
                  className={`${ghostButtonClass} text-[#b42318] hover:border-[#fda4af]`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="tambah-channel" className="glass-card p-5 sm:p-6">
        <h2 id="tambah-channel" className="text-lg font-display font-bold tracking-tight">
          Tambah Channel
        </h2>

        {atLimit ? (
          <p className="mt-3 text-sm text-secondary" role="status">
            Batas maksimal {MAX_CHANNELS} channel tercapai. Hapus salah satu channel untuk menambah yang baru.
          </p>
        ) : (
          <form onSubmit={handleAdd} className="mt-4 space-y-4">
            {formError && (
              <p className="rounded-sm border border-[#fda4af]/60 bg-[#fff1f2] px-4 py-3 text-sm text-[#881337]" role="alert">
                {formError}
              </p>
            )}

            <div>
              <label htmlFor="channel-type" className="mb-1.5 block text-sm font-semibold text-foreground">
                Tipe Channel
              </label>
              <select
                id="channel-type"
                value={type}
                onChange={(e) => setType(e.target.value as Channel["type"])}
                className={inputClass}
              >
                <option value="discord">Discord Webhook</option>
                <option value="telegram">Telegram Bot</option>
                <option value="custom">Custom Webhook</option>
              </select>
            </div>

            {type === "telegram" ? (
              <>
                <div>
                  <label htmlFor="bot-token" className="mb-1.5 block text-sm font-semibold text-foreground">
                    Bot Token
                  </label>
                  <input
                    id="bot-token"
                    type="password"
                    required
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456789:AA..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="chat-id" className="mb-1.5 block text-sm font-semibold text-foreground">
                    Chat ID
                  </label>
                  <input
                    id="chat-id"
                    type="text"
                    required
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="Contoh: 123456789"
                    className={inputClass}
                  />
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="webhook-url" className="mb-1.5 block text-sm font-semibold text-foreground">
                  {type === "discord" ? "Discord Webhook URL" : "Custom Webhook URL"}
                </label>
                <input
                  id="webhook-url"
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={
                    type === "discord"
                      ? "https://discord.com/api/webhooks/..."
                      : "https://contoh.com/webhook"
                  }
                  className={inputClass}
                />
              </div>
            )}

            <fieldset>
              <legend className="mb-1.5 block text-sm font-semibold text-foreground">
                Kategori Notifikasi
              </legend>
              <div className="flex flex-col gap-2">
                {CATEGORIES.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 text-sm text-secondary">
                    <input
                      type="checkbox"
                      checked={categories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="h-4 w-4 accent-[#08738a]"
                    />
                    {cat}
                  </label>
                ))}
              </div>
            </fieldset>

            <button type="submit" disabled={saving} className={primaryButtonClass}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {saving ? "Menyimpan" : "Tambah Channel"}
            </button>
            <p className="text-xs text-secondary">
              Channel baru berstatus nonaktif sampai pengiriman tes berhasil.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
