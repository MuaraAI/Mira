"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Compass, MessageCirclePlus, MessagesSquare, Plus } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { lockScroll } from "@/lib/scroll-lock";
import { useDialog } from "@/components/ConfirmDialog";
import { ErrorState, LoadingState, ghostButtonClass, primaryButtonClass } from "@/components/dashboard-ui";
import { ChatPane, type ActiveConversation, type ConversationState } from "@/components/social/ChatPane";
import { SocialLinkContext, forgetInvite, stripFormatting, type SocialLinkHandlers } from "@/components/social/MessageBody";
import { ConversationColumn, SpaceRail, type SidebarView } from "@/components/social/SocialSidebar";
import { ResizeHandle, useSidebarWidth } from "@/components/social/ResizeHandle";
import { useWallpaper } from "@/lib/wallpaper";
import {
  CreateSpaceSheet,
  JoinSheet,
  NewDmSheet,
  Onboarding,
  ProfileSheet,
  SpaceSettingsSheet,
} from "@/components/social/SocialSheets";
import {
  socialApi,
  useSocialStream,
  type ChannelItem,
  type DmItem,
  type Inbox,
  type LastMessage,
  type Member,
  type Message,
  type ReactionKey,
  type SocialEvent,
  type SocialProfile,
} from "@/lib/social";

type Sheet = null | "create" | "join" | "newdm" | "profile" | { settings: number };
type InboxConv = DmItem | ChannelItem;

const TYPING_TTL_MS = 5000;
const POLL_ACTIVE_MS = 4000;
const POLL_INBOX_MS = 20_000;

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Terjadi kesalahan. Coba lagi.");

const toLast = (m: Message): LastMessage => ({
  id: m.id,
  author: m.author,
  preview: m.deleted ? "Pesan dihapus" : m.body.replace(/\s+/g, " ").slice(0, 120),
  deleted: m.deleted,
  created_at: m.created_at,
});

function sortDms(dms: DmItem[]) {
  return [...dms].sort(
    (a, b) => Number(b.is_saved) - Number(a.is_saved) || (b.last_message?.id ?? 0) - (a.last_message?.id ?? 0) || b.id - a.id
  );
}

function findConv(inbox: Inbox | null, id: number | null): InboxConv | null {
  if (!inbox || id === null) return null;
  return inbox.dms.find((d) => d.id === id) ?? inbox.spaces.flatMap((s) => s.channels).find((c) => c.id === id) ?? null;
}

function insertMessage(list: Message[], message: Message): Message[] {
  const index = list.findIndex((m) => m.id === message.id);
  if (index >= 0) return list.map((m, i) => (i === index ? { ...message, clientKey: m.clientKey ?? message.clientKey } : m));
  if (!list.length || message.id > list[list.length - 1].id) return [...list, message];
  return [...list, message].sort((a, b) => a.id - b.id);
}

function titleCase(name: string) {
  return name.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()).trim();
}

const MOBILE_QUERY = "(max-width: 767px)";
const isMobile = () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

/**
 * Tinggi layar yang benar-benar terlihat (dikurangi keyboard virtual) sebagai CSS var,
 * supaya chat dan pencarian di HP mengecil mengikuti keyboard seperti aplikasi native.
 */
function useKeyboardViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
        root.style.setProperty("--vvt", `${Math.round(vv.offsetTop)}px`);
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vvt");
    };
  }, []);
}

function patchProfile<T extends Pick<SocialProfile, "username">>(item: T, username: string, patch: Partial<SocialProfile>): T {
  return item.username === username ? { ...item, ...patch } : item;
}

export function KomunitasApp() {
  const { confirm, notify } = useDialog();
  const [phase, setPhase] = useState<"loading" | "onboarding" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [view, setView] = useState<SidebarView>("home");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [convs, setConvs] = useState<Record<number, ConversationState>>({});
  const [typing, setTyping] = useState<Record<number, { name: string; until: number }>>({});
  const [members, setMembers] = useState<Record<number, Member[]>>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  const [joinCode, setJoinCode] = useState("");
  const [suggestedName, setSuggestedName] = useState("");
  const [visible, setVisible] = useState(true);
  const mobile = useIsMobile();
  const router = useRouter();
  const wallpaper = useWallpaper();
  const sidebar = useSidebarWidth();
  const columnRef = useRef<HTMLDivElement>(null);
  useKeyboardViewport();

  const me = inbox?.me?.username ?? "";
  const refs = useRef({ inbox, activeId, convs, me, visible });
  refs.current = { inbox, activeId, convs, me, visible };
  const pushedChat = useRef(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const debounce = useCallback((key: string, fn: () => void, ms = 400) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  }, []);

  /* ---------------------------------------------------------------- data */

  const loadInbox = useCallback(async () => {
    const data = await socialApi.inbox();
    setInbox({ ...data, dms: sortDms(data.dms) });
    return data;
  }, []);

  const loadMembers = useCallback(async (spaceId: number) => {
    try {
      const { members: list } = await socialApi.members(spaceId);
      setMembers((prev) => ({ ...prev, [spaceId]: list }));
    } catch {}
  }, []);

  const patchConv = useCallback((id: number, fn: (item: InboxConv) => Partial<InboxConv>) => {
    setInbox((prev) => {
      if (!prev) return prev;
      let touched = false;
      const dms = prev.dms.map((d) => {
        if (d.id !== id) return d;
        touched = true;
        return { ...d, ...fn(d) } as DmItem;
      });
      const spaces = prev.spaces.map((s) => {
        if (!s.channels.some((c) => c.id === id)) return s;
        touched = true;
        const channels = s.channels.map((c) => (c.id === id ? ({ ...c, ...fn(c) } as ChannelItem) : c));
        return {
          ...s,
          channels,
          unread: channels.reduce((n, c) => n + (c.unread ?? 0), 0),
          mentions: channels.reduce((n, c) => n + (c.mentions ?? 0), 0),
        };
      });
      return touched ? { ...prev, dms: sortDms(dms), spaces } : prev;
    });
  }, []);

  /** Terapkan perubahan status/profil seseorang ke semua tempat ia tampil (DM, anggota, diri sendiri). */
  const patchPerson = useCallback((username: string, patch: Partial<SocialProfile>) => {
    setInbox((prev) =>
      prev
        ? {
            ...prev,
            me: prev.me ? patchProfile(prev.me, username, patch) : prev.me,
            dms: prev.dms.map((d) => (d.peer.username === username ? { ...d, peer: { ...d.peer, ...patch } } : d)),
          }
        : prev
    );
    setMembers((prev) => {
      let changed = false;
      const next: Record<number, Member[]> = {};
      for (const [key, list] of Object.entries(prev)) {
        next[Number(key)] = list.map((m) => {
          if (m.username !== username) return m;
          changed = true;
          return { ...m, ...patch };
        });
      }
      return changed ? next : prev;
    });
  }, []);

  const upsertMessage = useCallback((conversationId: number, message: Message) => {
    setConvs((prev) => {
      const state = prev[conversationId];
      if (!state) return prev;
      return { ...prev, [conversationId]: { ...state, messages: insertMessage(state.messages, message) } };
    });
    patchConv(conversationId, (item) => (item.last_message?.id === message.id ? { last_message: toLast(message) } : {}));
  }, [patchConv]);

  const loadConversation = useCallback(async (id: number) => {
    const item = findConv(refs.current.inbox, id);
    setConvs((prev) => ({
      ...prev,
      [id]: { messages: [], pending: [], hasMore: false, loading: true, loadingOlder: false, peerLastReadId: null, unreadFromId: null, edits: [] },
    }));
    try {
      const page = await socialApi.messages(id);
      setConvs((prev) => ({
        ...prev,
        [id]: {
          messages: page.messages,
          pending: prev[id]?.pending ?? [],
          hasMore: page.has_more,
          loading: false,
          loadingOlder: false,
          peerLastReadId: page.peer_last_read_id,
          unreadFromId: item && (item.unread ?? 0) > 0 ? page.last_read_id : null,
          edits: page.recent_edits ?? [],
        },
      }));
    } catch (err) {
      setConvs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      notify(errorText(err), "error");
    }
  }, [notify]);

  /** Ambil pesan setelah pesan terakhir yang dimuat (sinkron ulang setelah reconnect / mode polling). */
  const catchUp = useCallback(async (id: number | null) => {
    if (id === null) return;
    const state = refs.current.convs[id];
    if (!state || state.loading) return;
    const after = state.messages[state.messages.length - 1]?.id ?? 0;
    try {
      const page = await socialApi.messages(id, { after });
      setConvs((prev) => {
        const current = prev[id];
        if (!current) return prev;
        const messages = page.messages.reduce(insertMessage, current.messages);
        return { ...prev, [id]: { ...current, messages, peerLastReadId: page.peer_last_read_id } };
      });
    } catch {}
  }, []);

  /* ---------------------------------------------------------------- navigation */

  const openConversation = useCallback((id: number) => {
    const inboxNow = refs.current.inbox;
    if (inboxNow?.dms.some((d) => d.id === id)) setView("home");
    else {
      const space = inboxNow?.spaces.find((s) => s.channels.some((c) => c.id === id));
      if (space) setView(space.id);
    }
    setActiveId(id);
    if (!refs.current.convs[id]) loadConversation(id);
    else catchUp(id);
    // URL ikut menyimpan chat aktif; di HP ini juga membuat tombol Back menutup chat seperti Telegram.
    const url = `${window.location.pathname}?c=${id}`;
    if (isMobile() && !pushedChat.current) {
      window.history.pushState(null, "", url);
      pushedChat.current = true;
    } else {
      window.history.replaceState(null, "", url);
    }
  }, [loadConversation, catchUp]);

  const closeConversation = useCallback(() => {
    if (pushedChat.current) {
      window.history.back();
      return;
    }
    setActiveId(null);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (!new URLSearchParams(window.location.search).get("c")) {
        pushedChat.current = false;
        setActiveId(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const messageUser = useCallback(async (username: string) => {
    try {
      const { conversation } = await socialApi.openDm(username === "__saved__" ? refs.current.me : username);
      await loadInbox();
      setSheet(null);
      setView("home");
      openConversation(conversation.id);
    } catch (err) {
      notify(errorText(err), "error");
    }
  }, [loadInbox, openConversation, notify]);

  /* ---------------------------------------------------------------- bootstrap */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("join");
    const initial = Number(params.get("c")) || null;
    if (code) {
      setJoinCode(code);
      window.history.replaceState(null, "", window.location.pathname);
    }
    socialApi
      .me()
      .then(async ({ needs_onboarding }) => {
        if (needs_onboarding) {
          setPhase("onboarding");
          apiFetch<{ nama?: string }>("/v1/studentv2/profile")
            .then((p) => p?.nama && setSuggestedName(titleCase(p.nama)))
            .catch(() => {});
          return;
        }
        const data = await loadInbox();
        setPhase("ready");
        if (code) setSheet("join");
        if (initial && findConv(data, initial) && !isMobile()) openConversation(initial);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err : new ApiError("ERROR", errorText(err), 0));
        setPhase("error");
      });
    // Bootstrap sekali saat halaman dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* ---------------------------------------------------------------- realtime */

  const onEvent = useCallback((event: SocialEvent) => {
    const { activeId: current, me: myName, visible: isVisible } = refs.current;
    switch (event.type) {
      case "message.created": {
        const { conversation_id: id, message } = event;
        if (!findConv(refs.current.inbox, id)) {
          debounce("inbox", () => loadInbox().catch(() => {}));
          break;
        }
        const mine = message.author.username === myName;
        setConvs((prev) => {
          const state = prev[id];
          if (!state) return prev;
          // Event pesan sendiri bisa datang sebelum respons HTTP: ambil alih bubble optimistisnya.
          const twin = mine ? state.pending.find((p) => p.body === message.body && p.local === "sending") : undefined;
          return {
            ...prev,
            [id]: {
              ...state,
              pending: twin ? state.pending.filter((p) => p !== twin) : state.pending,
              messages: insertMessage(state.messages, twin ? { ...message, clientKey: twin.clientKey } : message),
            },
          };
        });
        const viewing = current === id && isVisible;
        patchConv(id, (item) => ({
          last_message: toLast(message),
          unread: mine || viewing ? item.unread ?? 0 : (item.unread ?? 0) + 1,
          mentions: !mine && !viewing && event.mentioned ? (item.mentions ?? 0) + 1 : item.mentions ?? 0,
          ...(mine ? { last_read_id: message.id, unread: 0 } : {}),
        }));
        setTyping((prev) => {
          if (!prev[id] || prev[id].name !== message.author.display_name) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        break;
      }
      case "message.updated": {
        const { conversation_id: id, message } = event;
        upsertMessage(id, message);
        if (event.change === "deleted") {
          // Server sudah memundurkan preview ke pesan sebelumnya: ambil ulang daftar chat.
          debounce("inbox", () => loadInbox().catch(() => {}));
        } else if (event.change === "edited" && message.author.username !== myName) {
          setConvs((prev) => {
            const state = prev[id];
            if (!state) return prev;
            const edit = { id: message.id, author: message.author, preview: stripFormatting(message.body).slice(0, 90), edited_at: message.edited_at ?? "" };
            return { ...prev, [id]: { ...state, edits: [edit, ...state.edits.filter((e) => e.id !== message.id)].slice(0, 20) } };
          });
        }
        break;
      }
      case "presence":
        patchPerson(event.username, { online: event.online, last_seen_at: event.last_seen_at });
        break;
      case "profile.updated":
        patchPerson(event.username, event.profile);
        break;
      case "conversation.read":
        if (event.username === myName) {
          patchConv(event.conversation_id, () => ({ last_read_id: event.last_read_id, unread: 0, mentions: 0 }));
        } else {
          setConvs((prev) => {
            const state = prev[event.conversation_id];
            if (!state) return prev;
            return { ...prev, [event.conversation_id]: { ...state, peerLastReadId: Math.max(state.peerLastReadId ?? 0, event.last_read_id) } };
          });
          patchConv(event.conversation_id, (item) =>
            item.kind === "dm" ? { peer_last_read_id: Math.max(item.peer_last_read_id, event.last_read_id) } : {}
          );
        }
        break;
      case "typing":
        if (event.user.username !== myName) {
          setTyping((prev) => ({ ...prev, [event.conversation_id]: { name: event.user.display_name, until: Date.now() + TYPING_TTL_MS } }));
        }
        break;
      case "space.updated":
        debounce("inbox", () => loadInbox().catch(() => {}));
        debounce(`members:${event.space_id}`, () => loadMembers(event.space_id), 800);
        break;
      case "space.removed": {
        const space = refs.current.inbox?.spaces.find((s) => s.id === event.space_id);
        if (space && space.channels.some((c) => c.id === current)) {
          setActiveId(null);
          setView("home");
        }
        setView((v) => (v === event.space_id ? "home" : v));
        debounce("inbox", () => loadInbox().catch(() => {}));
        break;
      }
    }
  }, [debounce, loadInbox, loadMembers, patchConv, patchPerson, upsertMessage]);

  const streamConnectedOnce = useRef(false);
  const onReady = useCallback(() => {
    // Koneksi pertama datang tepat setelah bootstrap; hanya sambung ulang yang perlu menutup celah event.
    if (!streamConnectedOnce.current) {
      streamConnectedOnce.current = true;
      return;
    }
    loadInbox().catch(() => {});
    catchUp(refs.current.activeId);
  }, [loadInbox, catchUp]);

  const status = useSocialStream(phase === "ready", onEvent, onReady);

  useEffect(() => {
    if (status !== "polling" || phase !== "ready") return;
    const fast = setInterval(() => !document.hidden && catchUp(refs.current.activeId), POLL_ACTIVE_MS);
    const slow = setInterval(() => !document.hidden && loadInbox().catch(() => {}), POLL_INBOX_MS);
    return () => {
      clearInterval(fast);
      clearInterval(slow);
    };
  }, [status, phase, catchUp, loadInbox]);

  useEffect(() => {
    if (!Object.keys(typing).length) return;
    const timer = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(prev).filter(([, t]) => t.until > now));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [typing]);

  /* ---------------------------------------------------------------- derived */

  const active: ActiveConversation | null = useMemo(() => {
    if (!inbox || activeId === null) return null;
    const dm = inbox.dms.find((d) => d.id === activeId);
    if (dm) return { kind: "dm", dm };
    for (const space of inbox.spaces) {
      const channel = space.channels.find((c) => c.id === activeId);
      if (channel) return { kind: "channel", channel, space };
    }
    return null;
  }, [inbox, activeId]);

  // Percakapan hilang (channel dihapus, dikeluarkan dari ruang): kembali ke daftar.
  useEffect(() => {
    if (inbox && activeId !== null && !active) setActiveId(null);
  }, [inbox, activeId, active]);

  const activeSpaceId = active?.kind === "channel" ? active.space.id : null;
  useEffect(() => {
    if (activeSpaceId !== null && !members[activeSpaceId]) loadMembers(activeSpaceId);
  }, [activeSpaceId, members, loadMembers]);

  // Tandai dibaca saat percakapan terlihat dan ada pesan yang lebih baru dari read-state.
  const lastLoadedId = activeId !== null ? convs[activeId]?.messages.at(-1)?.id ?? 0 : 0;
  const activeItem = findConv(inbox, activeId);
  const needsRead = !!activeItem && lastLoadedId > 0 && (lastLoadedId > (activeItem.last_read_id ?? 0) || (activeItem.unread ?? 0) > 0);
  useEffect(() => {
    if (activeId === null || !needsRead || !visible) return;
    const id = activeId;
    const timer = setTimeout(() => {
      socialApi
        .read(id, lastLoadedId)
        .then((r) => patchConv(id, () => ({ last_read_id: r.last_read_id, unread: 0, mentions: 0 })))
        .catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [activeId, lastLoadedId, needsRead, visible, patchConv]);

  // Chat terbuka di HP menutupi layar penuh: kunci scroll halaman di belakangnya.
  const chatOpen = active !== null;
  useEffect(() => {
    if (!chatOpen || !mobile) return;
    return lockScroll();
  }, [chatOpen, mobile]);

  const typingIn = useMemo(() => new Set(Object.keys(typing).map(Number)), [typing]);

  /* ---------------------------------------------------------------- message actions */

  const patchPending = useCallback((id: number, clientKey: string, fn: (m: Message) => Message | null) => {
    setConvs((prev) => {
      const state = prev[id];
      if (!state) return prev;
      const pending = state.pending.flatMap((m) => (m.clientKey === clientKey ? (fn(m) ? [fn(m) as Message] : []) : [m]));
      return { ...prev, [id]: { ...state, pending } };
    });
  }, []);

  /** Kirim ke server untuk bubble optimistis; sukses = diganti versi server, gagal = tanda "Ketuk untuk kirim ulang". */
  const deliver = async (temp: Message) => {
    const id = temp.conversation_id;
    const key = temp.clientKey as string;
    try {
      const { message } = await socialApi.send(id, temp.body, temp.reply_to?.id);
      setConvs((prev) => {
        const state = prev[id];
        if (!state) return prev;
        return {
          ...prev,
          [id]: {
            ...state,
            pending: state.pending.filter((p) => p.clientKey !== key),
            messages: insertMessage(state.messages, { ...message, clientKey: key }),
            unreadFromId: null,
          },
        };
      });
      patchConv(id, () => ({ last_message: toLast(message), last_read_id: message.id, unread: 0, mentions: 0 }));
    } catch (err) {
      patchPending(id, key, (m) => ({ ...m, local: "failed" }));
      notify(errorText(err), "error");
    }
  };

  const send = async (text: string, replyTo: Message | null) => {
    const profile = refs.current.inbox?.me;
    if (activeId === null || !profile) return false;
    const now = Date.now();
    const temp: Message = {
      id: -now,
      conversation_id: activeId,
      author: { username: profile.username, display_name: profile.display_name },
      body: text,
      reply_to: replyTo
        ? { id: replyTo.id, author: replyTo.author, preview: replyTo.body.replace(/\s+/g, " ").slice(0, 90), deleted: false }
        : null,
      reactions: [],
      pinned: false,
      created_at: new Date(now).toISOString(),
      edited_at: null,
      deleted: false,
      clientKey: `tmp-${now}-${Math.random().toString(36).slice(2, 7)}`,
      local: "sending",
    };
    setConvs((prev) => (prev[activeId] ? { ...prev, [activeId]: { ...prev[activeId], pending: [...prev[activeId].pending, temp] } } : prev));
    void deliver(temp);
    return true;
  };

  const retry = (message: Message) => {
    if (message.local !== "failed" || !message.clientKey) return;
    const next = { ...message, local: "sending" as const };
    patchPending(message.conversation_id, message.clientKey, () => next);
    void deliver(next);
  };

  const runMessage = async (conversationId: number, task: Promise<{ message: Message }>, success?: string) => {
    try {
      const { message } = await task;
      upsertMessage(conversationId, message);
      if (success) notify(success, "success");
      return true;
    } catch (err) {
      notify(errorText(err), "error");
      return false;
    }
  };

  const loadOlder = async () => {
    if (activeId === null) return;
    const id = activeId;
    const state = convs[id];
    if (!state || state.loadingOlder || !state.hasMore || !state.messages.length) return;
    setConvs((prev) => ({ ...prev, [id]: { ...prev[id], loadingOlder: true } }));
    try {
      const page = await socialApi.messages(id, { before: state.messages[0].id });
      setConvs((prev) => ({
        ...prev,
        [id]: { ...prev[id], messages: [...page.messages, ...prev[id].messages], hasMore: page.has_more, loadingOlder: false },
      }));
    } catch {
      setConvs((prev) => ({ ...prev, [id]: { ...prev[id], loadingOlder: false } }));
    }
  };

  /* ---------------------------------------------------------------- link di dalam chat */

  const linkHandlers: SocialLinkHandlers = useMemo(
    () => ({
      openInternal: (path) => {
        const url = new URL(path, window.location.origin);
        const chat = Number(url.searchParams.get("c"));
        if (url.pathname.replace(/\/+$/, "") === "/dashboard/komunitas" && chat && findConv(refs.current.inbox, chat)) {
          openConversation(chat);
          return;
        }
        router.push(path);
      },
      openInvite: async (code) => {
        try {
          const { space } = await socialApi.invite(code);
          const joined = refs.current.inbox?.spaces.find((s) => s.id === space.id);
          if (space.joined && joined?.channels[0]) {
            setView(joined.id);
            openConversation(joined.channels[0].id);
            return;
          }
        } catch {}
        setJoinCode(code);
        setSheet("join");
      },
    }),
    [router, openConversation]
  );

  /* ---------------------------------------------------------------- render */

  if (phase === "loading") return <LoadingState label="Membuka Komunitas" />;
  if (phase === "error") return <ErrorState error={loadError} onRetry={() => window.location.reload()} />;
  if (phase === "onboarding") {
    return (
      <Onboarding
        suggestedName={suggestedName}
        onDone={async () => {
          try {
            await loadInbox();
            setPhase("ready");
            if (joinCode) setSheet("join");
          } catch (err) {
            notify(errorText(err), "error");
          }
        }}
      />
    );
  }
  if (!inbox?.me) return null;

  const settingsSpace = typeof sheet === "object" && sheet ? inbox.spaces.find((s) => s.id === sheet.settings) ?? null : null;

  // Di HP chat dirender lewat portal: wrapper halaman beranimasi transform sehingga `fixed` di dalamnya ikut terkurung.
  const chatPane = active && (
    <div
      className={mobile ? "chat-ui fixed inset-x-0 z-[45] flex bg-white" : "flex min-w-0 flex-1"}
      style={mobile ? { top: "var(--vvt, 0px)", height: "var(--vvh, 100dvh)" } : undefined}
    >
      <ChatPane
        active={active}
        state={convs[active.kind === "dm" ? active.dm.id : active.channel.id]}
        me={me}
        typingName={activeId !== null ? typing[activeId]?.name ?? null : null}
        members={activeSpaceId !== null ? members[activeSpaceId] ?? [] : []}
        onBack={closeConversation}
        onLoadOlder={loadOlder}
        onSend={send}
        onEdit={(m, text) => runMessage(m.conversation_id, socialApi.edit(m.id, text))}
        onRetry={retry}
        onDelete={async (m) => {
          if (m.local && m.clientKey) {
            patchPending(m.conversation_id, m.clientKey, () => null);
            return;
          }
          const ok = await confirm({ title: "Hapus pesan?", message: "Pesan hilang untuk semua orang di percakapan ini.", confirmLabel: "Hapus", tone: "danger" });
          if (ok && (await runMessage(m.conversation_id, socialApi.remove(m.id)))) debounce("inbox", () => loadInbox().catch(() => {}));
        }}
        wallpaper={wallpaper.style}
        onDismissEdits={() =>
          setConvs((prev) => (activeId !== null && prev[activeId] ? { ...prev, [activeId]: { ...prev[activeId], edits: [] } } : prev))
        }
        onReact={(m, key: ReactionKey) => runMessage(m.conversation_id, socialApi.react(m.id, key))}
        onPin={(m) => runMessage(m.conversation_id, socialApi.pin(m.id, !m.pinned), m.pinned ? "Sematan dilepas" : "Pesan disematkan")}
        onTyping={() => {
          if (status === "live" && activeId !== null) socialApi.typing(activeId).catch(() => {});
        }}
        onMessageUser={messageUser}
      />
    </div>
  );

  return (
    <>
      <SocialLinkContext.Provider value={linkHandlers}>
      <div className="chat-ui -mx-2 -mt-3 flex h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] min-h-[360px] min-w-0 flex-col overflow-hidden bg-white sm:-mx-4 md:mx-0 md:mt-0 md:h-[calc(100dvh-9.75rem-env(safe-area-inset-bottom))] md:flex-row md:shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#CFE2EE] lg:h-[calc(100dvh-5.5rem)] lg:min-h-[520px]">
        <SpaceRail
          inbox={inbox}
          view={view}
          onView={(v) => {
            setView(v);
            if (v !== "home") {
              const space = inbox.spaces.find((s) => s.id === v);
              // Desktop langsung membuka channel pertama, seperti Discord.
              if (space?.channels[0] && !isMobile()) openConversation(space.channels[0].id);
            }
          }}
          onCreate={() => setSheet("create")}
          onJoin={() => setSheet("join")}
        />
        <div
          ref={columnRef}
          className="flex min-h-0 min-w-0 flex-1 md:flex-none"
          style={sidebar.width ? ({ "--col-w": `${sidebar.width}px` } as React.CSSProperties) : undefined}
        >
          <ConversationColumn
            inbox={inbox}
            view={view}
            activeId={activeId}
            status={status}
            typingIn={typingIn}
            onOpen={openConversation}
            onNewDm={() => setSheet("newdm")}
            onSpaceSettings={(space) => {
              setSheet({ settings: space.id });
              if (!members[space.id]) loadMembers(space.id);
            }}
            onProfile={() => setSheet("profile")}
          />
        </div>
        <ResizeHandle
          width={sidebar.width}
          min={sidebar.min}
          max={sidebar.max}
          targetRef={columnRef}
          onResize={sidebar.setWidth}
          onCommit={sidebar.commit}
        />

        {active && !mobile ? (
          chatPane
        ) : (
          <div className="chat-wall hidden flex-1 flex-col items-center justify-center p-8 text-center md:flex">
            <span className="px-icon h-16 w-16">
              <MessagesSquare className="h-8 w-8" aria-hidden="true" />
            </span>
            <p className="mt-4 font-display text-lg font-bold text-[#072033]">Pilih obrolan</p>
            <p className="mt-1 max-w-sm text-sm text-[#3B5A70]">
              Buka chat pribadi atau channel di kiri. Belum punya ruang? Buat ruang untuk kelasmu lalu bagikan link undangannya.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => setSheet("newdm")} className={primaryButtonClass}>
                <MessageCirclePlus className="h-4 w-4" aria-hidden="true" /> Chat baru
              </button>
              <button type="button" onClick={() => setSheet("create")} className={ghostButtonClass}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Buat ruang
              </button>
              <button type="button" onClick={() => setSheet("join")} className={ghostButtonClass}>
                <Compass className="h-4 w-4" aria-hidden="true" /> Jelajahi
              </button>
            </div>
          </div>
        )}
      </div>

      {active && mobile && createPortal(<SocialLinkContext.Provider value={linkHandlers}>{chatPane}</SocialLinkContext.Provider>, document.body)}

      <CreateSpaceSheet
        open={sheet === "create"}
        onClose={() => setSheet(null)}
        onCreated={async (space) => {
          setSheet(null);
          await loadInbox();
          setView(space.id);
          if (space.channels[0]) openConversation(space.channels[0].id);
          notify(`Ruang ${space.name} dibuat. Bagikan link undangan dari menu pengaturan.`, "success");
        }}
      />
      <JoinSheet
        open={sheet === "join"}
        initialCode={joinCode}
        onClose={() => {
          setSheet(null);
          setJoinCode("");
        }}
        onJoined={async (space) => {
          if (joinCode) forgetInvite(joinCode);
          setSheet(null);
          setJoinCode("");
          await loadInbox();
          setView(space.id);
          if (space.channels[0]) openConversation(space.channels[0].id);
          notify(`Bergabung ke ${space.name}`, "success");
        }}
      />
      <NewDmSheet open={sheet === "newdm"} onClose={() => setSheet(null)} onPick={messageUser} />
      <ProfileSheet
        open={sheet === "profile"}
        me={inbox.me}
        onClose={() => setSheet(null)}
        onSaved={(profile, close) => {
          setInbox((prev) => (prev ? { ...prev, me: profile } : prev));
          if (close) {
            setSheet(null);
            notify("Profil disimpan", "success");
          }
        }}
      />
      {settingsSpace && (
        <SpaceSettingsSheet
          open
          space={settingsSpace}
          me={me}
          members={members[settingsSpace.id] ?? []}
          onClose={() => setSheet(null)}
          onChanged={() => loadInbox().catch(() => {})}
          onLeft={() => {
            setSheet(null);
            setView("home");
            setActiveId(null);
            loadInbox().catch(() => {});
          }}
          onMessage={messageUser}
          reloadMembers={() => loadMembers(settingsSpace.id)}
        />
      )}
      </SocialLinkContext.Provider>
    </>
  );
}
