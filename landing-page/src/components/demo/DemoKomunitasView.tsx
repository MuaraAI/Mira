"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Compass, MessageCirclePlus, MessagesSquare, Plus } from "lucide-react";
import { useDialog } from "@/components/ConfirmDialog";
import { ChatPane, type ActiveConversation, type ConversationState } from "@/components/social/ChatPane";
import { SocialLinkContext, type SocialLinkHandlers } from "@/components/social/MessageBody";
import { ConversationColumn, SpaceRail, type SidebarView } from "@/components/social/SocialSidebar";
import { ResizeHandle, useSidebarWidth } from "@/components/social/ResizeHandle";
import { useWallpaper } from "@/lib/wallpaper";
import type {
  AuthorRef,
  ChannelItem,
  DmItem,
  Inbox,
  LastMessage,
  Member,
  Message,
  ReactionKey,
  SocialProfile,
} from "@/lib/social";

const MOBILE_QUERY = "(max-width: 767px)";
const isMobileViewport = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;

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

const ME_PROFILE: SocialProfile = {
  username: "dinda",
  display_name: "Dinda Putri Lestari",
  bio: "Informatika UBSI 15.3A.01",
  avatar: null,
  banner: null,
  online: true,
  last_seen_at: null,
};

const RAFI_PROFILE: SocialProfile = {
  username: "rafi",
  display_name: "Rafi Pratama",
  bio: "15.3A.01 · Backend & Basis Data",
  avatar: null,
  banner: null,
  online: true,
  last_seen_at: null,
};

const NADIA_PROFILE: SocialProfile = {
  username: "nadia",
  display_name: "Nadia Kusuma",
  bio: "Komting 15.3A.01",
  avatar: null,
  banner: null,
  online: false,
  last_seen_at: "2026-11-24T09:15:00+07:00",
};

const HENDRA_PROFILE: SocialProfile = {
  username: "bagas",
  display_name: "Bagas Prakoso",
  bio: "Informatika UBSI Pontianak",
  avatar: null,
  banner: null,
  online: true,
  last_seen_at: null,
};

const toAuthor = (p: SocialProfile): AuthorRef => ({
  username: p.username,
  display_name: p.display_name,
  avatar: p.avatar,
});

const toLast = (m: Message): LastMessage => ({
  id: m.id,
  author: m.author,
  preview: m.deleted ? "Pesan dihapus" : m.body.replace(/\s+/g, " ").slice(0, 120),
  deleted: m.deleted,
  created_at: m.created_at,
});

const INITIAL_MESSAGES: Record<number, Message[]> = {
  101: [
    {
      id: 1001,
      conversation_id: 101,
      author: toAuthor(RAFI_PROFILE),
      body: "Din, info ruang Lab 1 pagi ini AC sudah nyala normal ya.",
      reply_to: null,
      reactions: [{ key: "up", count: 1, users: ["dinda"] }],
      pinned: false,
      created_at: "2026-11-23T08:12:00+07:00",
      edited_at: null,
      deleted: false,
    },
    {
      id: 1002,
      conversation_id: 101,
      author: toAuthor(ME_PROFILE),
      body: "Siap makasih infonya, aku lagi otw ke kampus.",
      reply_to: null,
      reactions: [],
      pinned: false,
      created_at: "2026-11-23T08:15:00+07:00",
      edited_at: null,
      deleted: false,
    },
    {
      id: 1003,
      conversation_id: 101,
      author: toAuthor(ME_PROFILE),
      body: "Btw Tugas 3 normalisasi ERD sudah kamu kerjakan sampai 3NF?",
      reply_to: null,
      reactions: [],
      pinned: false,
      created_at: "2026-11-24T09:40:00+07:00",
      edited_at: null,
      deleted: false,
    },
    {
      id: 1004,
      conversation_id: 101,
      author: toAuthor(RAFI_PROFILE),
      body: "Sudah, tinggal rapikan tabel detail transaksi biar ga ada atribut turunan.",
      reply_to: {
        id: 1003,
        author: toAuthor(ME_PROFILE),
        preview: "Btw Tugas 3 normalisasi ERD sudah kamu kerjakan sampai 3NF?",
        deleted: false,
      },
      reactions: [{ key: "fire", count: 1, users: ["dinda"] }],
      pinned: false,
      created_at: "2026-11-24T09:46:00+07:00",
      edited_at: null,
      deleted: false,
    },
  ],
  102: [
    {
      id: 1011,
      conversation_id: 102,
      author: toAuthor(NADIA_PROFILE),
      body: "Slide Pertemuan 7 Pemrograman Web sudah diunggah di menu Bahan Ajar.",
      reply_to: null,
      reactions: [],
      pinned: false,
      created_at: "2026-11-23T19:10:00+07:00",
      edited_at: null,
      deleted: false,
    },
    {
      id: 1012,
      conversation_id: 102,
      author: toAuthor(ME_PROFILE),
      body: "Oke Nad, nanti kucek bareng jadwal ruang UTS.",
      reply_to: null,
      reactions: [],
      pinned: false,
      created_at: "2026-11-24T07:50:00+07:00",
      edited_at: null,
      deleted: false,
    },
  ],
  103: [
    {
      id: 1021,
      conversation_id: 103,
      author: toAuthor(ME_PROFILE),
      body: "Catatan: bawa kartu peserta UTS sebelum 10 Nov jam 08:45 di ruang EN2-P1.",
      reply_to: null,
      reactions: [],
      pinned: true,
      created_at: "2026-11-22T20:00:00+07:00",
      edited_at: null,
      deleted: false,
    },
  ],
  201: [
    {
      id: 2001,
      conversation_id: 201,
      author: toAuthor(NADIA_PROFILE),
      body: "Selamat pagi teman-teman 15.3A.01, presensi Pemrograman Web sudah dibuka.",
      reply_to: null,
      reactions: [{ key: "check", count: 6, users: ["dinda", "rafi"] }],
      pinned: true,
      created_at: "2026-11-24T08:02:00+07:00",
      edited_at: null,
      deleted: false,
    },
    {
      id: 2002,
      conversation_id: 201,
      author: toAuthor(RAFI_PROFILE),
      body: "Siap Nad, sudah absen dari Mira.",
      reply_to: null,
      reactions: [],
      pinned: false,
      created_at: "2026-11-24T08:04:00+07:00",
      edited_at: null,
      deleted: false,
    },
    {
      id: 2003,
      conversation_id: 201,
      author: toAuthor(ME_PROFILE),
      body: "Sesi Basis Data Lanjut jam 10:45 tetap di R. 204 kan?",
      reply_to: null,
      reactions: [],
      pinned: false,
      created_at: "2026-11-24T08:25:00+07:00",
      edited_at: null,
      deleted: false,
    },
  ],
  202: [
    {
      id: 2011,
      conversation_id: 202,
      author: toAuthor(HENDRA_PROFILE),
      body: "Untuk Tugas 3 Basis Data Lanjut, format PDF atau SQL dump?",
      reply_to: null,
      reactions: [],
      pinned: false,
      created_at: "2026-11-24T09:10:00+07:00",
      edited_at: null,
      deleted: false,
    },
    {
      id: 2012,
      conversation_id: 202,
      author: toAuthor(ME_PROFILE),
      body: "PDF diagram ERD ditambah skema DDL dalam satu file ya.",
      reply_to: {
        id: 2011,
        author: toAuthor(HENDRA_PROFILE),
        preview: "Untuk Tugas 3 Basis Data Lanjut, format PDF atau SQL dump?",
        deleted: false,
      },
      reactions: [{ key: "up", count: 2, users: ["bagas"] }],
      pinned: false,
      created_at: "2026-11-24T09:14:00+07:00",
      edited_at: null,
      deleted: false,
    },
  ],
  203: [
    {
      id: 2021,
      conversation_id: 203,
      author: toAuthor(NADIA_PROFILE),
      body: "Kartu Ujian UTS Ganjil sudah dapat diunduh melalui menu Kartu Ujian.",
      reply_to: null,
      reactions: [{ key: "clap", count: 9, users: ["dinda", "rafi"] }],
      pinned: true,
      created_at: "2026-11-23T15:00:00+07:00",
      edited_at: null,
      deleted: false,
    },
  ],
  204: [
    {
      id: 2031,
      conversation_id: 204,
      author: toAuthor(RAFI_PROFILE),
      body: "Ada yang sudah coba MCP Server Mira di Cursor atau Claude Desktop?",
      reply_to: null,
      reactions: [{ key: "rocket", count: 3, users: ["dinda"] }],
      pinned: false,
      created_at: "2026-11-23T21:18:00+07:00",
      edited_at: null,
      deleted: false,
    },
    {
      id: 2032,
      conversation_id: 204,
      author: toAuthor(HENDRA_PROFILE),
      body: "Sudah, tinggal pasang Personal API Key lalu 40 tool mira_* langsung muncul.",
      reply_to: null,
      reactions: [],
      pinned: false,
      created_at: "2026-11-24T08:55:00+07:00",
      edited_at: null,
      deleted: false,
    },
  ],
  205: [
    {
      id: 2041,
      conversation_id: 205,
      author: toAuthor(NADIA_PROFILE),
      body: "Pendaftaran Asisten Laboratorium Komputer dibuka untuk semester 3 ke atas (IPK >= 3.50).",
      reply_to: null,
      reactions: [{ key: "heart", count: 5, users: ["dinda"] }],
      pinned: true,
      created_at: "2026-11-22T11:30:00+07:00",
      edited_at: null,
      deleted: false,
    },
  ],
};

function buildInitialInbox(): Inbox {
  return {
    me: ME_PROFILE,
    dms: [
      {
        id: 103,
        kind: "dm",
        is_saved: true,
        peer: ME_PROFILE,
        last_message: toLast(INITIAL_MESSAGES[103][0]),
        last_read_id: 1021,
        peer_last_read_id: 1021,
        unread: 0,
        mentions: 0,
      },
      {
        id: 101,
        kind: "dm",
        is_saved: false,
        peer: RAFI_PROFILE,
        last_message: toLast(INITIAL_MESSAGES[101][INITIAL_MESSAGES[101].length - 1]),
        last_read_id: 1004,
        peer_last_read_id: 1003,
        unread: 0,
        mentions: 0,
      },
      {
        id: 102,
        kind: "dm",
        is_saved: false,
        peer: NADIA_PROFILE,
        last_message: toLast(INITIAL_MESSAGES[102][INITIAL_MESSAGES[102].length - 1]),
        last_read_id: 1011,
        peer_last_read_id: 1012,
        unread: 1,
        mentions: 0,
      },
    ],
    spaces: [
      {
        id: 1,
        name: "Kelas 15.3A.01",
        description: "Ruang koordinasi resmi kelas 15.3A.01 UBSI Pontianak.",
        is_public: false,
        avatar: null,
        banner: null,
        member_count: 32,
        online_count: 8,
        my_role: "member",
        invite_code: "demo-153a01",
        created_at: "2026-09-01T08:00:00+07:00",
        unread: 1,
        mentions: 0,
        channels: [
          {
            id: 201,
            kind: "channel",
            space_id: 1,
            name: "umum",
            topic: "Obrolan harian kelas 15.3A.01",
            position: 0,
            last_message: toLast(INITIAL_MESSAGES[201][INITIAL_MESSAGES[201].length - 1]),
            last_read_id: 2002,
            unread: 1,
            mentions: 0,
          },
          {
            id: 202,
            kind: "channel",
            space_id: 1,
            name: "tugas-deadline",
            topic: "Diskusi tugas, ERD, dan praktikum",
            position: 1,
            last_message: toLast(INITIAL_MESSAGES[202][INITIAL_MESSAGES[202].length - 1]),
            last_read_id: 2012,
            unread: 0,
            mentions: 0,
          },
          {
            id: 203,
            kind: "channel",
            space_id: 1,
            name: "pengumuman",
            topic: "Info penting dari komting",
            position: 2,
            admin_only: true,
            last_message: toLast(INITIAL_MESSAGES[203][0]),
            last_read_id: 2021,
            unread: 0,
            mentions: 0,
          },
        ],
      },
      {
        id: 2,
        name: "Informatika UBSI",
        description: "Forum angkatan Program Studi Teknik Informatika.",
        is_public: true,
        avatar: null,
        banner: null,
        member_count: 148,
        online_count: 19,
        my_role: "member",
        invite_code: "demo-ifubsi",
        created_at: "2026-09-01T08:00:00+07:00",
        unread: 0,
        mentions: 0,
        channels: [
          {
            id: 204,
            kind: "channel",
            space_id: 2,
            name: "diskusi-koding",
            topic: "Web, Basis Data, Jaringan, dan AI",
            position: 0,
            last_message: toLast(INITIAL_MESSAGES[204][INITIAL_MESSAGES[204].length - 1]),
            last_read_id: 2032,
            unread: 0,
            mentions: 0,
          },
          {
            id: 205,
            kind: "channel",
            space_id: 2,
            name: "karir-magang",
            topic: "Info magang, beasiswa, dan portofolio",
            position: 1,
            last_message: toLast(INITIAL_MESSAGES[205][0]),
            last_read_id: 2041,
            unread: 0,
            mentions: 0,
          },
        ],
      },
    ],
  };
}

const DEMO_MEMBERS: Record<number, Member[]> = {
  1: [
    { ...NADIA_PROFILE, role: "owner", joined_at: "2026-09-01T08:00:00+07:00" },
    { ...RAFI_PROFILE, role: "admin", joined_at: "2026-09-01T08:15:00+07:00" },
    { ...ME_PROFILE, role: "member", joined_at: "2026-09-02T09:00:00+07:00" },
    { ...HENDRA_PROFILE, role: "member", joined_at: "2026-09-03T10:30:00+07:00" },
  ],
  2: [
    { ...NADIA_PROFILE, role: "admin", joined_at: "2026-09-01T08:00:00+07:00" },
    { ...RAFI_PROFILE, role: "member", joined_at: "2026-09-01T08:15:00+07:00" },
    { ...ME_PROFILE, role: "member", joined_at: "2026-09-02T09:00:00+07:00" },
    { ...HENDRA_PROFILE, role: "member", joined_at: "2026-09-03T10:30:00+07:00" },
  ],
};

function buildInitialConvs(): Record<number, ConversationState> {
  const result: Record<number, ConversationState> = {};
  for (const [idStr, msgs] of Object.entries(INITIAL_MESSAGES)) {
    const id = Number(idStr);
    result[id] = {
      messages: msgs,
      pending: [],
      hasMore: false,
      loading: false,
      loadingOlder: false,
      peerLastReadId: id === 101 ? 1003 : msgs[msgs.length - 1]?.id ?? null,
      unreadFromId: null,
      edits: [],
    };
  }
  return result;
}

export function DemoKomunitasView() {
  const { confirm, notify } = useDialog();
  const [inbox, setInbox] = useState<Inbox>(() => buildInitialInbox());
  const [view, setView] = useState<SidebarView>("home");
  const [activeId, setActiveId] = useState<number | null>(() => (isMobileViewport() ? null : 101));
  const [convs, setConvs] = useState<Record<number, ConversationState>>(() => buildInitialConvs());
  const mobile = useIsMobile();
  const wallpaper = useWallpaper();
  const sidebar = useSidebarWidth();
  const columnRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(5000);
  const typingIn = useMemo(() => new Set<number>(), []);

  useEffect(() => {
    if (!mobile && activeId === null) {
      setActiveId(101);
    }
  }, [mobile, activeId]);

  const patchConv = useCallback((id: number, fn: (c: DmItem | ChannelItem) => Partial<DmItem | ChannelItem>) => {
    setInbox((prev) => ({
      ...prev,
      dms: prev.dms.map((d) => (d.id === id ? ({ ...d, ...fn(d) } as DmItem) : d)),
      spaces: prev.spaces.map((s) => {
        if (!s.channels.some((c) => c.id === id)) return s;
        const channels = s.channels.map((c) =>
          c.id === id ? ({ ...c, ...fn(c) } as ChannelItem) : c
        );
        return {
          ...s,
          channels,
          unread: channels.reduce((sum, ch) => sum + (ch.unread ?? 0), 0),
        };
      }),
    }));
  }, []);

  const openConversation = useCallback(
    (id: number) => {
      if (inbox.dms.some((d) => d.id === id)) {
        setView("home");
      } else {
        const space = inbox.spaces.find((s) => s.channels.some((c) => c.id === id));
        if (space) setView(space.id);
      }
      setActiveId(id);
      patchConv(id, () => ({ unread: 0, mentions: 0 }));
    },
    [inbox.dms, inbox.spaces, patchConv]
  );

  const active = useMemo<ActiveConversation | null>(() => {
    if (activeId === null) return null;
    const dm = inbox.dms.find((d) => d.id === activeId);
    if (dm) return { kind: "dm", dm };
    for (const space of inbox.spaces) {
      const channel = space.channels.find((c) => c.id === activeId);
      if (channel) return { kind: "channel", channel, space };
    }
    return null;
  }, [inbox, activeId]);

  const activeSpaceId = active?.kind === "channel" ? active.space.id : null;

  const sendMessage = useCallback(
    async (text: string, replyTo: Message | null): Promise<boolean> => {
      if (activeId === null) return false;
      const msgId = ++nextId.current;
      const msg: Message = {
        id: msgId,
        conversation_id: activeId,
        author: toAuthor(ME_PROFILE),
        body: text,
        reply_to: replyTo
          ? {
              id: replyTo.id,
              author: replyTo.author,
              preview: replyTo.deleted ? "Pesan dihapus" : replyTo.body.slice(0, 90),
              deleted: replyTo.deleted,
            }
          : null,
        reactions: [],
        pinned: false,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted: false,
      };
      setConvs((prev) => {
        const cur = prev[activeId];
        if (!cur) return prev;
        return {
          ...prev,
          [activeId]: { ...cur, messages: [...cur.messages, msg] },
        };
      });
      patchConv(activeId, () => ({ last_message: toLast(msg), last_read_id: msgId, unread: 0 }));
      return true;
    },
    [activeId, patchConv]
  );

  const editMessage = useCallback(
    async (target: Message, text: string): Promise<boolean> => {
      setConvs((prev) => {
        const cur = prev[target.conversation_id];
        if (!cur) return prev;
        const editedAt = new Date().toISOString();
        const messages = cur.messages.map((m) =>
          m.id === target.id ? { ...m, body: text, edited_at: editedAt } : m
        );
        return { ...prev, [target.conversation_id]: { ...cur, messages } };
      });
      return true;
    },
    []
  );

  const deleteMessage = useCallback(
    async (target: Message) => {
      const ok = await confirm({
        title: "Hapus pesan?",
        message: "Pesan akan ditandai terhapus di pratinjau percakapan ini.",
        confirmLabel: "Hapus",
        tone: "danger",
      });
      if (!ok) return;
      setConvs((prev) => {
        const cur = prev[target.conversation_id];
        if (!cur) return prev;
        const messages = cur.messages.map((m) =>
          m.id === target.id ? { ...m, deleted: true, body: "" } : m
        );
        return { ...prev, [target.conversation_id]: { ...cur, messages } };
      });
    },
    [confirm]
  );

  const toggleReact = useCallback((target: Message, key: ReactionKey) => {
    setConvs((prev) => {
      const cur = prev[target.conversation_id];
      if (!cur) return prev;
      const messages = cur.messages.map((m) => {
        if (m.id !== target.id) return m;
        const existing = m.reactions.find((r) => r.key === key);
        const meName = ME_PROFILE.username;
        let reactions = m.reactions;
        if (!existing) {
          reactions = [...m.reactions, { key, count: 1, users: [meName] }];
        } else if (existing.users.includes(meName)) {
          reactions = m.reactions
            .map((r) =>
              r.key === key
                ? {
                    ...r,
                    count: Math.max(0, r.count - 1),
                    users: r.users.filter((u) => u !== meName),
                  }
                : r
            )
            .filter((r) => r.count > 0);
        } else {
          reactions = m.reactions.map((r) =>
            r.key === key ? { ...r, count: r.count + 1, users: [...r.users, meName] } : r
          );
        }
        return { ...m, reactions };
      });
      return { ...prev, [target.conversation_id]: { ...cur, messages } };
    });
  }, []);

  const togglePin = useCallback(
    (target: Message) => {
      setConvs((prev) => {
        const cur = prev[target.conversation_id];
        if (!cur) return prev;
        const messages = cur.messages.map((m) =>
          m.id === target.id ? { ...m, pinned: !m.pinned } : m
        );
        return { ...prev, [target.conversation_id]: { ...cur, messages } };
      });
      notify(target.pinned ? "Sematan dilepas" : "Pesan disematkan", "success");
    },
    [notify]
  );

  const messageUser = useCallback(
    (username: string) => {
      const dm =
        username === "__saved__"
          ? inbox.dms.find((d) => d.is_saved)
          : inbox.dms.find((d) => d.peer.username === username);
      if (dm) {
        openConversation(dm.id);
        return;
      }
      notify("Mode demo: DM baru tersedia setelah masuk dengan akun kampus.");
    },
    [inbox.dms, openConversation, notify]
  );

  const demoNotice = useCallback(() => {
    notify("Mode demo: fitur ini aktif penuh setelah masuk akun kampus.");
  }, [notify]);

  const linkHandlers = useMemo<SocialLinkHandlers>(
    () => ({
      openInternal: () => demoNotice(),
      openInvite: () => demoNotice(),
    }),
    [demoNotice]
  );

  const chatPane = active ? (
    <div className={mobile ? "chat-ui fixed inset-0 z-[45] flex bg-white" : "flex min-w-0 flex-1"}>
      <ChatPane
        active={active}
        state={convs[active.kind === "dm" ? active.dm.id : active.channel.id]}
        me={ME_PROFILE.username}
        typingName={null}
        members={activeSpaceId !== null ? DEMO_MEMBERS[activeSpaceId] ?? [] : []}
        wallpaper={wallpaper.style}
        onBack={() => setActiveId(null)}
        onLoadOlder={() => {}}
        onSend={sendMessage}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onReact={toggleReact}
        onPin={togglePin}
        onRetry={() => {}}
        onTyping={() => {}}
        onMessageUser={messageUser}
        onDismissEdits={() => {}}
        onSpaceSettings={() => demoNotice()}
        onLeaveSpace={() => demoNotice()}
      />
    </div>
  ) : null;

  return (
    <SocialLinkContext.Provider value={linkHandlers}>
      <div className="chat-ui -mx-2 -mt-3 flex h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] min-h-[360px] min-w-0 flex-col overflow-hidden bg-white sm:-mx-4 md:mx-0 md:mt-0 md:h-[calc(100dvh-9.75rem-env(safe-area-inset-bottom))] md:flex-row md:rounded-[12px] md:border-[1px] md:border-stroke lg:h-[calc(100dvh-5.5rem)] lg:min-h-[520px]">
        <SpaceRail
          inbox={inbox}
          view={view}
          onView={(v) => {
            setView(v);
            if (v !== "home") {
              const space = inbox.spaces.find((s) => s.id === v);
              if (space?.channels[0] && !isMobileViewport()) {
                openConversation(space.channels[0].id);
              }
            } else if (!isMobileViewport() && inbox.dms[1]) {
              openConversation(inbox.dms[1].id);
            }
          }}
          onCreate={demoNotice}
          onJoin={demoNotice}
        />

        <div
          ref={columnRef}
          className="flex min-h-0 min-w-0 flex-1 md:flex-none"
          style={
            sidebar.width ? ({ "--col-w": `${sidebar.width}px` } as React.CSSProperties) : undefined
          }
        >
          <ConversationColumn
            inbox={inbox}
            view={view}
            activeId={activeId}
            status="live"
            typingIn={typingIn}
            onOpen={openConversation}
            onNewDm={demoNotice}
            onSpaceSettings={demoNotice}
            onProfile={demoNotice}
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
            <span className="flex h-16 w-16 items-center justify-center rounded-[10px] border-[1px] border-stroke bg-white text-[#0369A1]">
              <MessagesSquare className="h-8 w-8" aria-hidden="true" />
            </span>
            <p className="mt-4 text-lg text-[#072033]">Pilih obrolan</p>
            <p className="mt-1 max-w-sm text-sm text-[#3B5A70]">
              Buka pesan pribadi atau channel kelas di kiri untuk mencoba percakapan interaktif.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={demoNotice}
                className="inline-flex min-h-10 items-center gap-2 rounded-[6px] bg-[#072033] px-4 text-xs text-white hover:bg-[#0369A1]"
              >
                <MessageCirclePlus className="h-4 w-4" aria-hidden="true" /> Chat baru
              </button>
              <button
                type="button"
                onClick={demoNotice}
                className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border-[1px] border-stroke bg-white px-4 text-xs text-foreground hover:border-[#072033]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Buat ruang
              </button>
              <button
                type="button"
                onClick={demoNotice}
                className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border-[1px] border-stroke bg-white px-4 text-xs text-foreground hover:border-[#072033]"
              >
                <Compass className="h-4 w-4" aria-hidden="true" /> Jelajahi
              </button>
            </div>
          </div>
        )}
      </div>

      {active && mobile ? (
        <SocialLinkContext.Provider value={linkHandlers}>
          {createPortal(chatPane, document.body)}
        </SocialLinkContext.Provider>
      ) : null}
    </SocialLinkContext.Provider>
  );
}
