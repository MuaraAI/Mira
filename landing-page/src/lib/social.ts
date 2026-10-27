"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, getApiBase, readSessionToken } from "@/lib/api";

/* ------------------------------------------------------------------ types */

export interface SocialProfile {
  username: string;
  display_name: string;
  bio: string;
  /** Id media (lihat mediaUrl) atau null. */
  avatar: string | null;
  banner: string | null;
  online: boolean;
  last_seen_at: string | null;
}

export interface AuthorRef {
  username: string;
  display_name: string;
  avatar?: string | null;
}

export type ReactionKey =
  | "heart" | "haha" | "fire" | "up" | "wow" | "sad"
  | "pray" | "clap" | "party" | "hundred" | "eyes" | "skull"
  | "think" | "love" | "cool" | "salute" | "rocket" | "check"
  | "rofl" | "sob" | "melt" | "sparkles";

export interface Message {
  id: number;
  conversation_id: number;
  author: AuthorRef;
  body: string;
  reply_to: { id: number; author: AuthorRef; preview: string; deleted: boolean } | null;
  reactions: { key: ReactionKey; count: number; users: string[] }[];
  pinned: boolean;
  created_at: string;
  edited_at: string | null;
  deleted: boolean;
  /** Kunci render stabil: pesan optimistis dan versi server-nya memakai DOM yang sama (tanpa animasi ulang). */
  clientKey?: string;
  /** Hanya di klien: pesan sedang dikirim atau gagal terkirim. */
  local?: "sending" | "failed";
}

export interface LastMessage {
  id: number;
  author: AuthorRef;
  preview: string;
  deleted: boolean;
  created_at: string;
}

export interface DmItem {
  id: number;
  kind: "dm";
  is_saved: boolean;
  peer: SocialProfile;
  last_message: LastMessage | null;
  last_read_id: number;
  peer_last_read_id: number;
  unread: number;
  mentions: number;
}

export interface ChannelItem {
  id: number;
  kind: "channel";
  space_id: number;
  name: string;
  topic: string;
  position: number;
  /** Channel pengumuman: hanya admin yang bisa mengirim. */
  admin_only?: boolean;
  last_message?: LastMessage | null;
  last_read_id?: number;
  unread?: number;
  mentions?: number;
}

export type SpaceRole = "owner" | "admin" | "member";

export interface SpaceItem {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  avatar: string | null;
  banner: string | null;
  member_count: number;
  online_count?: number;
  my_role: SpaceRole | null;
  invite_code?: string;
  created_at: string;
  channels: ChannelItem[];
  unread?: number;
  mentions?: number;
}

export interface Inbox {
  me: SocialProfile | null;
  dms: DmItem[];
  spaces: SpaceItem[];
}

export interface MessagePage {
  conversation_id: number;
  messages: Message[];
  has_more: boolean;
  my_role: SpaceRole | null;
  last_read_id: number;
  peer_last_read_id: number | null;
  /** Pesan orang lain yang diedit sejak terakhir percakapan ini dibuka. */
  recent_edits: RecentEdit[];
}

export interface RecentEdit {
  id: number;
  author: AuthorRef;
  preview: string;
  edited_at: string;
}

export interface InvitePreview {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  avatar: string | null;
  banner: string | null;
  member_count: number;
  online_count: number;
  my_role: SpaceRole | null;
  joined: boolean;
}

export interface Member extends SocialProfile {
  role: SpaceRole;
  joined_at: string;
}

export type SocialEvent =
  | { type: "message.created"; conversation_id: number; space_id: number | null; message: Message; mentioned: boolean }
  | { type: "message.updated"; conversation_id: number; message: Message; change?: "edited" | "deleted" | "reaction" | "pinned" }
  | { type: "presence"; username: string; online: boolean; last_seen_at: string }
  | { type: "profile.updated"; username: string; profile: SocialProfile }
  | { type: "conversation.read"; conversation_id: number; username: string; last_read_id: number }
  | { type: "typing"; conversation_id: number; user: AuthorRef }
  | { type: "space.updated"; space_id: number }
  | { type: "space.removed"; space_id: number };

/* ------------------------------------------------------------------ api */

const BASE = "/v1/social";

export const socialApi = {
  me: () => apiFetch<{ profile: SocialProfile | null; needs_onboarding: boolean }>(`${BASE}/me`),
  saveProfile: (body: { username: string; display_name: string; bio: string }) =>
    apiFetch<{ profile: SocialProfile }>(`${BASE}/me`, { method: "PATCH", json: body }),
  setMyMedia: (body: { avatar?: string | null; banner?: string | null }) =>
    apiFetch<{ profile: SocialProfile }>(`${BASE}/me/media`, { method: "PATCH", json: body }),
  setSpaceMedia: (id: number, body: { avatar?: string | null; banner?: string | null }) =>
    apiFetch<{ space: SpaceItem }>(`${BASE}/spaces/${id}/media`, { method: "PATCH", json: body }),
  uploadMedia: async (blob: Blob, kind: "avatar" | "banner") => {
    const form = new FormData();
    form.append("file", blob, `${kind}.webp`);
    form.append("kind", kind);
    return apiFetch<{ id: string }>(`${BASE}/media`, { form });
  },
  invite: (code: string) => apiFetch<{ space: InvitePreview }>(`${BASE}/invites/${encodeURIComponent(code)}`),
  inbox: () => apiFetch<Inbox>(`${BASE}/inbox`),
  searchUsers: (q: string) => apiFetch<{ users: SocialProfile[] }>(`${BASE}/users?q=${encodeURIComponent(q)}`),

  createSpace: (body: { name: string; description: string; is_public: boolean }) =>
    apiFetch<{ space: SpaceItem }>(`${BASE}/spaces`, { json: body }),
  discover: (q: string) => apiFetch<{ spaces: SpaceItem[] }>(`${BASE}/spaces/discover?q=${encodeURIComponent(q)}`),
  joinByInvite: (invite_code: string) => apiFetch<{ space: SpaceItem }>(`${BASE}/spaces/join`, { json: { invite_code } }),
  joinPublic: (id: number) => apiFetch<{ space: SpaceItem }>(`${BASE}/spaces/${id}/join`, { method: "POST" }),
  updateSpace: (id: number, body: Partial<{ name: string; description: string; is_public: boolean }>) =>
    apiFetch<{ space: SpaceItem }>(`${BASE}/spaces/${id}`, { method: "PATCH", json: body }),
  deleteSpace: (id: number) => apiFetch(`${BASE}/spaces/${id}`, { method: "DELETE" }),
  leaveSpace: (id: number) => apiFetch(`${BASE}/spaces/${id}/leave`, { method: "POST" }),
  resetInvite: (id: number) => apiFetch<{ space: SpaceItem }>(`${BASE}/spaces/${id}/invite/reset`, { method: "POST" }),
  members: (id: number) => apiFetch<{ members: Member[] }>(`${BASE}/spaces/${id}/members`),
  setRole: (id: number, username: string, role: SpaceRole) =>
    apiFetch(`${BASE}/spaces/${id}/members/${encodeURIComponent(username)}`, { method: "PATCH", json: { role } }),
  kick: (id: number, username: string) =>
    apiFetch(`${BASE}/spaces/${id}/members/${encodeURIComponent(username)}`, { method: "DELETE" }),
  createChannel: (spaceId: number, body: { name: string; topic: string }) =>
    apiFetch<{ channel: ChannelItem }>(`${BASE}/spaces/${spaceId}/channels`, { json: body }),
  reorderChannels: (spaceId: number, ids: number[]) =>
    apiFetch<{ space: SpaceItem }>(`${BASE}/spaces/${spaceId}/channels/order`, { json: { ids } }),
  updateChannel: (id: number, body: Partial<{ name: string; topic: string; admin_only: boolean }>) =>
    apiFetch<{ channel: ChannelItem }>(`${BASE}/conversations/${id}`, { method: "PATCH", json: body }),
  deleteChannel: (id: number) => apiFetch(`${BASE}/conversations/${id}`, { method: "DELETE" }),

  openDm: (username: string) =>
    apiFetch<{ conversation: { id: number; is_saved: boolean; peer: SocialProfile } }>(`${BASE}/dms`, { json: { username } }),
  messages: (id: number, params: { before?: number; after?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)));
    const query = qs.toString();
    return apiFetch<MessagePage>(`${BASE}/conversations/${id}/messages${query ? `?${query}` : ""}`);
  },
  send: (id: number, body: string, reply_to_id?: number) =>
    apiFetch<{ message: Message }>(`${BASE}/conversations/${id}/messages`, { json: { body, reply_to_id } }),
  edit: (messageId: number, body: string) =>
    apiFetch<{ message: Message }>(`${BASE}/messages/${messageId}`, { method: "PATCH", json: { body } }),
  remove: (messageId: number) => apiFetch<{ message: Message }>(`${BASE}/messages/${messageId}`, { method: "DELETE" }),
  react: (messageId: number, key: ReactionKey) =>
    apiFetch<{ message: Message }>(`${BASE}/messages/${messageId}/reactions/${key}`, { method: "POST" }),
  pin: (messageId: number, pinned: boolean) =>
    apiFetch<{ message: Message }>(`${BASE}/messages/${messageId}/pin`, { method: pinned ? "POST" : "DELETE" }),
  pins: (id: number) => apiFetch<{ messages: Message[] }>(`${BASE}/conversations/${id}/pins`),
  search: (id: number, q: string) =>
    apiFetch<{ messages: Message[] }>(`${BASE}/conversations/${id}/search?q=${encodeURIComponent(q)}`),
  read: (id: number, message_id: number) =>
    apiFetch<{ last_read_id: number }>(`${BASE}/conversations/${id}/read`, { json: { message_id } }),
  typing: (id: number) => apiFetch(`${BASE}/conversations/${id}/typing`, { method: "POST" }),
};

/* ------------------------------------------------------------------ realtime */

export type StreamStatus = "connecting" | "live" | "polling";

/**
 * SSE lewat fetch (bukan EventSource) supaya bisa membawa header Authorization.
 * Stream dijeda saat tab tersembunyi; kalau server menolak (503) atau koneksi
 * terus gagal, status menjadi "polling" dan halaman beralih ke polling ringan.
 */
export function useSocialStream(enabled: boolean, onEvent: (event: SocialEvent) => void, onReady: () => void) {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const handlers = useRef({ onEvent, onReady });
  handlers.current = { onEvent, onReady };

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(connect, ms);
    };

    async function connect() {
      if (stopped || document.hidden) return;
      controller = new AbortController();
      const token = readSessionToken();
      try {
        const res = await fetch(`${getApiBase()}/v1/social/stream`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "text/event-stream",
            "X-Requested-With": "dashboard",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok || !res.body) {
          setStatus("polling");
          // 503 = Redis/slot penuh: coba lagi pelan-pelan, sementara halaman polling.
          return schedule(res.status === 503 ? 60_000 : 20_000);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");
            if (chunk.startsWith("event: ready")) {
              failures = 0;
              setStatus("live");
              handlers.current.onReady();
              continue;
            }
            const data = chunk
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trimStart())
              .join("\n");
            if (!data) continue;
            try {
              handlers.current.onEvent(JSON.parse(data) as SocialEvent);
            } catch {}
          }
        }
        // Server menutup stream secara berkala (rotasi); sambung lagi segera.
        if (!stopped) schedule(500);
      } catch {
        if (stopped || controller?.signal.aborted) return;
        failures += 1;
        if (failures >= 3) setStatus("polling");
        schedule(Math.min(15_000, 1000 * 2 ** failures));
      }
    }

    const onVisibility = () => {
      if (document.hidden) {
        controller?.abort();
        if (timer) clearTimeout(timer);
      } else {
        setStatus((s) => (s === "live" ? "connecting" : s));
        schedule(0);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    connect();
    return () => {
      stopped = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return status;
}

/* ------------------------------------------------------------------ helpers */

const AVATAR_TONES = [
  { bg: "#0369A1", fg: "#FFFFFF" },
  { bg: "#0F766E", fg: "#FFFFFF" },
  { bg: "#072033", fg: "#FFFFFF" },
  { bg: "#5FA3CC", fg: "#072033" },
  { bg: "#9A3412", fg: "#FFFFFF" },
  { bg: "#FCD34D", fg: "#072033" },
  { bg: "#163A55", fg: "#FFFFFF" },
  { bg: "#9CC6E0", fg: "#072033" },
];

export function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const pad = (n: number) => String(n).padStart(2, "0");

export function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Waktu ringkas untuk daftar chat ala Telegram: jam hari ini, "Kemarin", atau tanggal. */
export function listTime(iso: string): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diff === 0) return clockTime(iso);
  if (diff === 1) return "Kemarin";
  if (diff < 7) return d.toLocaleDateString("id-ID", { weekday: "short" });
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function lastSeenLabel(profile: Pick<SocialProfile, "online" | "last_seen_at">): string {
  if (profile.online) return "online";
  if (!profile.last_seen_at) return "belum pernah online";
  const d = new Date(profile.last_seen_at);
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutes < 1) return "baru saja online";
  if (minutes < 60) return `terakhir dilihat ${minutes} menit lalu`;
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diff === 0) return `terakhir dilihat pukul ${clockTime(profile.last_seen_at)}`;
  if (diff === 1) return `terakhir dilihat kemarin`;
  return `terakhir dilihat ${d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`;
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/dashboard/komunitas?join=${code}`;
}

export const MAX_BODY = 2000;

/** Maskot Mura resmi yang bisa dipakai sebagai avatar profil komunitas. */
export const MURA_AVATARS = [
  { id: "mura_welcome", label: "Mura Menyapa", path: "/avatars/mura/mura_welcome.png" },
  { id: "mura-empty", label: "Mura Santai", path: "/avatars/mura/mura-empty.png" },
  { id: "mura-tugas-done", label: "Tugas Beres", path: "/avatars/mura/mura-tugas-done.png" },
  { id: "mura-buku-tumpuk", label: "Kutu Buku", path: "/avatars/mura/mura-buku-tumpuk.png" },
  { id: "mura-kuis", label: "Mikir Kuis", path: "/avatars/mura/mura-kuis.png" },
  { id: "mura-nilai", label: "Pamer Nilai", path: "/avatars/mura/mura-nilai.png" },
  { id: "mura_empty_library", label: "Perpustakaan", path: "/avatars/mura/mura_empty_library.png" },
  { id: "mura_maintenance", label: "Oprek", path: "/avatars/mura/mura_maintenance.png" },
  { id: "mura_stream_broken", label: "Bingung", path: "/avatars/mura/mura_stream_broken.png" },
  { id: "velnime-empty-search", label: "Velnime", path: "/avatars/mura/velnime-empty-search.png" },
] as const;

/** URL publik gambar Komunitas (avatar/banner) dari id media atau preset maskot. */
export function mediaUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  // Preset maskot Mura: path lokal Next.js (/avatars/mura/*.png).
  if (id.startsWith("/")) return id;
  return `${getApiBase()}/v1/social/media/${id}`;
}

/** Ambil kode undangan dari link `.../dashboard/komunitas?join=KODE` (origin mana pun milik Mira). */
export function inviteCodeFrom(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.replace(/\/+$/, "").endsWith("/dashboard/komunitas")) return null;
    const code = parsed.searchParams.get("join");
    return code && /^[A-Za-z0-9]{4,40}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/**
 * Kecilkan gambar di perangkat sebelum diunggah: crop tengah ke rasio target lalu WebP.
 * Avatar 256x256 (~10-20 KB), banner 960x320 (~30-60 KB): ringan untuk kuota dan server.
 */
export async function compressImage(file: File, kind: "avatar" | "banner"): Promise<Blob> {
  const [w, h] = kind === "avatar" ? [256, 256] : [960, 320];
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(w / bitmap.width, h / bitmap.height);
  const sw = w / scale;
  const sh = h / scale;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pengolahan gambar");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, w, h);
  bitmap.close();
  for (const quality of [0.86, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (blob && blob.size <= (kind === "avatar" ? 280_000 : 760_000)) return blob;
  }
  throw new Error("Gambar terlalu besar setelah dikompres");
}

// Warna kutipan balasan per pengirim: semua lolos kontras teks di atas putih (>= 4.5:1).
const REPLY_TONES = ["#0369A1", "#0F766E", "#9A3412", "#7C3AED", "#BE123C", "#1D4ED8", "#A16207", "#047857"];

export function replyColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) | 0;
  return REPLY_TONES[Math.abs(hash) % REPLY_TONES.length];
}
