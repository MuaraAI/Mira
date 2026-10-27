"use client";

import { useMemo, useState } from "react";
import { BellOff, Compass, Hash, MessageCirclePlus, MessagesSquare, Plus, Search, Settings2, UserPlus } from "lucide-react";
import { Avatar, PixelTick, SpaceTile } from "@/components/social/Avatar";
import { stripFormatting } from "@/components/social/MessageBody";
import { useChatPrefs } from "@/lib/chatPrefs";
import { listTime, type DmItem, type Inbox, type SpaceItem, type StreamStatus } from "@/lib/social";

export type SidebarView = "home" | number;

function CountBadge({ count, mention = false, muted = false }: { count: number; mention?: boolean; muted?: boolean }) {
  if (!count) return null;
  return (
    <span
      className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center px-1 font-mono text-[10px] font-bold text-white ${
        mention ? "bg-[#BE123C]" : muted ? "bg-[#9CC6E0]" : "bg-[#0369A1]"
      }`}
    >
      {mention ? "@" : count > 99 ? "99+" : count}
    </span>
  );
}

/** Rail kiri ala Discord: Pesan pribadi di atas, lalu daftar ruang. Di HP berubah jadi baris horizontal. */
export function SpaceRail({
  inbox,
  view,
  onView,
  onCreate,
  onJoin,
}: {
  inbox: Inbox;
  view: SidebarView;
  onView: (view: SidebarView) => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  const prefs = useChatPrefs();
  // Chat yang dibisukan tidak ikut dihitung di total (mention tetap dihitung, seperti WhatsApp).
  const dmUnread = inbox.dms.reduce((sum, d) => sum + (prefs.isMuted(d.id) ? 0 : d.unread), 0);
  const spaceUnread = (space: SpaceItem) => space.channels.reduce((n, c) => n + (prefs.isMuted(c.id) ? 0 : c.unread ?? 0), 0);
  const railButton = "group relative flex shrink-0 items-center justify-center";
  return (
    <nav
      aria-label="Ruang komunitas"
      className="scroll-slim flex shrink-0 items-center gap-2 overflow-x-auto border-b-2 border-[#CFE2EE] bg-[#F0F7FB] px-3 py-2 md:w-[68px] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r-2 md:px-2 md:py-3"
    >
      <button type="button" onClick={() => onView("home")} aria-current={view === "home" ? "page" : undefined} aria-label="Pesan pribadi" title="Pesan pribadi" className={railButton}>
        <span
          className={`flex h-10 w-10 items-center justify-center transition-[background-color,color,box-shadow,transform] duration-200 md:h-11 md:w-11 ${
            view === "home"
              ? "-translate-x-px -translate-y-px bg-[#0369A1] text-white shadow-[3px_3px_0_0_#072033]"
              : "bg-white text-[#0369A1] shadow-[0_0_0_2px_#CFE2EE] group-hover:shadow-[0_0_0_2px_#5FA3CC]"
          }`}
        >
          <MessagesSquare className="h-5 w-5" aria-hidden="true" />
        </span>
        {dmUnread > 0 && (
          <span className="absolute -right-1 -top-1">
            <CountBadge count={dmUnread} />
          </span>
        )}
      </button>

      <span className="mx-1 w-0.5 shrink-0 self-stretch bg-[#CFE2EE] md:mx-0 md:my-1 md:h-0.5 md:w-8 md:self-center" aria-hidden="true" />

      {inbox.spaces.map((space) => {
        const active = view === space.id;
        return (
          <button
            key={space.id}
            type="button"
            onClick={() => onView(space.id)}
            aria-current={active ? "page" : undefined}
            aria-label={`${space.name}${space.unread ? `, ${space.unread} belum dibaca` : ""}`}
            title={space.name}
            className={railButton}
          >
            {/* Penanda kiri ala Discord: tinggi = aktif, titik = ada pesan baru. */}
            <span
              className={`absolute -left-2 hidden w-1 bg-[#072033] transition-all md:block ${active ? "h-8" : space.unread ? "h-2" : "h-0"}`}
              aria-hidden="true"
            />
            <span className="md:hidden">
              <SpaceTile name={space.name} src={space.avatar} active={active} compact />
            </span>
            <span className="hidden md:inline-flex">
              <SpaceTile name={space.name} src={space.avatar} active={active} />
            </span>
            {(space.mentions ?? 0) > 0 ? (
              <span className="absolute -right-1 -top-1">
                <CountBadge count={space.mentions ?? 0} mention />
              </span>
            ) : spaceUnread(space) > 0 && !active ? (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 border-2 border-[#EAF3F9] bg-[#0369A1]" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}

      <button type="button" onClick={onCreate} aria-label="Buat ruang baru" title="Buat ruang" className={railButton}>
        <span className="flex h-10 w-10 items-center justify-center bg-white text-[#0F766E] md:h-11 md:w-11 shadow-[0_0_0_2px_#CFE2EE] transition-shadow group-hover:shadow-[0_0_0_2px_#0F766E]">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </span>
      </button>
      <button type="button" onClick={onJoin} aria-label="Jelajahi dan gabung ruang" title="Jelajahi ruang" className={railButton}>
        <span className="flex h-10 w-10 items-center justify-center bg-white text-[#0369A1] shadow-[0_0_0_2px_#CFE2EE] transition-shadow group-hover:shadow-[0_0_0_2px_#0369A1] md:h-11 md:w-11">
          <Compass className="h-5 w-5" aria-hidden="true" />
        </span>
      </button>
    </nav>
  );
}

function StatusDot({ status }: { status: StreamStatus }) {
  const meta = {
    live: { label: "Online", color: "bg-[#16A34A]", text: "text-[#15803D]" },
    connecting: { label: "Menyambung...", color: "bg-[#F59E0B]", text: "text-[#A16207]" },
    polling: { label: "Online · hemat", color: "bg-[#16A34A]", text: "text-[#15803D]" },
  }[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold ${meta.text}`}
      title={status === "polling" ? "Koneksi realtime tidak tersedia, pesan dicek berkala" : undefined}
      role="status"
    >
      <span className={`h-2 w-2 ${meta.color} ${status === "connecting" ? "animate-pulse" : ""}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Kolom kedua: daftar chat ala Telegram (home) atau daftar channel ala Discord (ruang). */
export function ConversationColumn({
  inbox,
  view,
  activeId,
  status,
  typingIn,
  onOpen,
  onNewDm,
  onSpaceSettings,
  onProfile,
}: {
  inbox: Inbox;
  view: SidebarView;
  activeId: number | null;
  status: StreamStatus;
  typingIn: Set<number>;
  onOpen: (conversationId: number) => void;
  onNewDm: () => void;
  onSpaceSettings: (space: SpaceItem) => void;
  onProfile: () => void;
}) {
  const [filter, setFilter] = useState("");
  const me = inbox.me;
  const space = view === "home" ? null : inbox.spaces.find((s) => s.id === view) ?? null;

  const dms = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return inbox.dms;
    return inbox.dms.filter((d) => d.peer.display_name.toLowerCase().includes(q) || d.peer.username.includes(q) || (d.is_saved && "pesan tersimpan".includes(q)));
  }, [inbox.dms, filter]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white md:w-[var(--col-w,264px)] md:flex-none md:border-r-2 md:border-[#CFE2EE] lg:w-[var(--col-w,320px)]">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b-2 border-[#CFE2EE] px-3">
        {space ? (
          <>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-bold text-[#072033]">{space.name}</h2>
              <p className="truncate text-[11px] text-[#3B5A70]">{space.member_count} anggota</p>
            </div>
            <button type="button" onClick={() => onSpaceSettings(space)} aria-label="Undang teman" title="Undang teman" className="flex h-10 w-10 items-center justify-center text-[#0369A1] hover:bg-[#EAF3F9]">
              <UserPlus className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => onSpaceSettings(space)} aria-label="Pengaturan ruang" title="Pengaturan ruang" className="flex h-10 w-10 items-center justify-center text-[#3B5A70] hover:bg-[#EAF3F9] hover:text-[#072033]">
              <Settings2 className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <h2 className="flex-1 text-[17px] font-bold tracking-tight text-[#072033]">Pesan</h2>
            <button type="button" onClick={onNewDm} aria-label="Chat baru" title="Chat baru" className="flex h-10 w-10 items-center justify-center text-[#0369A1] hover:bg-[#EAF3F9]">
              <MessageCirclePlus className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {!space && (
        <div className="shrink-0 px-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3B5A70]" aria-hidden="true" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari chat" aria-label="Cari chat" className="px-input min-h-10 w-full pl-9 pr-3 text-base text-[#072033] placeholder:text-[#3B5A70]/60 sm:text-sm" />
          </div>
        </div>
      )}

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-2">
        {space ? (
          <ChannelList space={space} activeId={activeId} onOpen={onOpen} />
        ) : dms.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <MessagesSquare className="mx-auto h-8 w-8 text-[#9CC6E0]" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-[#072033]">{filter ? "Chat tidak ditemukan" : "Belum ada chat"}</p>
            {!filter && (
              <button type="button" onClick={onNewDm} className="mt-3 font-mono text-xs font-bold text-[#0369A1] hover:text-[#075985]">
                Mulai chat baru
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {dms.map((dm) => (
              <DmRow key={dm.id} dm={dm} me={me?.username ?? ""} active={dm.id === activeId} typing={typingIn.has(dm.id)} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </div>

      {me && (
        <div className="flex shrink-0 items-center gap-2 border-t-2 border-[#CFE2EE] bg-[#F7FAFC] px-3 py-2">
          <button type="button" onClick={onProfile} className="flex min-w-0 flex-1 items-center gap-2.5 py-1 text-left hover:opacity-80" title="Ubah profil">
            <Avatar name={me.display_name} seed={me.username} src={me.avatar} size="sm" online={status !== "connecting"} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#072033]">{me.display_name}</span>
              <span className="block truncate text-[11px] text-[#3B5A70]">@{me.username}</span>
            </span>
          </button>
          <StatusDot status={status} />
        </div>
      )}
    </div>
  );
}

function DmRow({ dm, me, active, typing, onOpen }: { dm: DmItem; me: string; active: boolean; typing: boolean; onOpen: (id: number) => void }) {
  const prefs = useChatPrefs();
  const muted = prefs.isMuted(dm.id);
  const name = dm.is_saved ? "Pesan Tersimpan" : dm.peer.display_name;
  const last = dm.last_message;
  const mine = last?.author.username === me;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(dm.id)}
        aria-current={active ? "true" : undefined}
        className={`flex w-full items-center gap-3 px-2 py-2.5 text-left transition-[background-color,box-shadow] duration-150 ${
          active ? "bg-[#DCEBF5] shadow-[inset_3px_0_0_#0369A1]" : "hover:bg-[#F0F7FB]"
        }`}
      >
        <Avatar name={name} seed={dm.peer.username} src={dm.peer.avatar} size="lg" online={dm.is_saved ? undefined : dm.peer.online} saved={dm.is_saved} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={`truncate text-[15px] text-[#072033] ${dm.unread ? "font-bold" : "font-semibold"}`}>{name}</span>
            {last && <span className={`chat-time ml-auto shrink-0 text-[11px] ${dm.unread ? "font-bold text-[#0369A1]" : "text-[#3B5A70]"}`}>{listTime(last.created_at)}</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={`flex min-w-0 flex-1 items-center text-[14px] ${dm.unread ? "text-[#072033]" : "text-[#3B5A70]"}`}>
              {typing ? (
                <span className="font-semibold text-[#0369A1]">mengetik...</span>
              ) : last ? (
                <span className="inline-flex max-w-full items-center gap-1">
                  {mine && !dm.is_saved && <PixelTick state={dm.peer_last_read_id >= last.id ? "read" : "sent"} />}
                  <span className="truncate">{stripFormatting(last.preview)}</span>
                </span>
              ) : (
                <span className="italic">{dm.is_saved ? "Simpan catatan untuk diri sendiri" : "Belum ada pesan"}</span>
              )}
            </span>
            <span className="ml-auto">
              <span className="inline-flex items-center gap-1">
                {muted && <BellOff className="h-3.5 w-3.5 text-[#9CC6E0]" aria-label="Dibisukan" />}
                <CountBadge count={dm.unread} muted={muted} />
              </span>
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

function ChannelList({ space, activeId, onOpen }: { space: SpaceItem; activeId: number | null; onOpen: (id: number) => void }) {
  const prefs = useChatPrefs();
  return (
    <>
      {space.description && <p className="mb-2 px-2 text-xs leading-relaxed text-[#3B5A70]">{space.description}</p>}
      <p className="mb-1 flex items-center gap-2 px-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#3B5A70]/80">
        <span className="h-1.5 w-1.5 bg-[#9CC6E0]" aria-hidden="true" />
        Channel
      </p>
      <ul className="space-y-px">
        {space.channels.map((channel) => {
          const active = channel.id === activeId;
          const unread = channel.unread ?? 0;
          return (
            <li key={channel.id}>
              <button
                type="button"
                onClick={() => onOpen(channel.id)}
                aria-current={active ? "true" : undefined}
                className={`flex min-h-11 w-full items-center gap-2 px-2.5 text-left text-[14px] md:min-h-10 transition-[background-color,color,box-shadow] duration-150 ${
                  active
                    ? "bg-[#DCEBF5] font-semibold text-[#072033] shadow-[inset_3px_0_0_#0369A1]"
                    : unread
                      ? "font-bold text-[#072033] hover:bg-[#F0F7FB]"
                      : "font-medium text-[#3B5A70] hover:bg-[#F0F7FB] hover:text-[#072033]"
                }`}
              >
                <Hash className={`h-4 w-4 shrink-0 ${active ? "text-[#0369A1]" : ""}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                {prefs.isMuted(channel.id) && <BellOff className="h-3.5 w-3.5 shrink-0 text-[#9CC6E0]" aria-label="Dibisukan" />}
                {(channel.mentions ?? 0) > 0 ? (
                  <CountBadge count={channel.mentions ?? 0} mention />
                ) : (
                  !active && <CountBadge count={unread} muted={prefs.isMuted(channel.id)} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
