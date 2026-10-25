"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Hash, Pencil, Pin, Search, Users, X } from "lucide-react";
import { useDialog } from "@/components/ConfirmDialog";
import { Avatar } from "@/components/social/Avatar";
import { Composer } from "@/components/social/Composer";
import { MessageList } from "@/components/social/MessageList";
import { MemberList, PinsSheet, ProfileCard, SearchSheet } from "@/components/social/SocialSheets";
import { SideSheet } from "@/components/SideSheet";
import {
  lastSeenLabel,
  type AuthorRef,
  type ChannelItem,
  type DmItem,
  type Member,
  type Message,
  type ReactionKey,
  type RecentEdit,
  type SpaceItem,
} from "@/lib/social";

export interface ConversationState {
  messages: Message[];
  /** Bubble optimistis yang belum dikonfirmasi server (selalu tampil paling bawah). */
  pending: Message[];
  hasMore: boolean;
  loading: boolean;
  loadingOlder: boolean;
  peerLastReadId: number | null;
  unreadFromId: number | null;
  /** Pesan orang lain yang diedit (sejak terakhir dibuka, atau realtime saat sedang dibuka). */
  edits: RecentEdit[];
}

export type ActiveConversation =
  | { kind: "dm"; dm: DmItem }
  | { kind: "channel"; channel: ChannelItem; space: SpaceItem };

/** Render ulang berkala supaya label "terakhir dilihat X menit lalu" tetap akurat. */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
}

export function ChatPane({
  active,
  state,
  me,
  typingName,
  members,
  wallpaper,
  onBack,
  onLoadOlder,
  onSend,
  onEdit,
  onDelete,
  onReact,
  onPin,
  onRetry,
  onTyping,
  onMessageUser,
  onDismissEdits,
}: {
  active: ActiveConversation;
  state: ConversationState | undefined;
  me: string;
  typingName: string | null;
  members: Member[];
  wallpaper: React.CSSProperties;
  onBack: () => void;
  onLoadOlder: () => void;
  onSend: (text: string, replyTo: Message | null) => Promise<boolean>;
  onEdit: (message: Message, text: string) => Promise<boolean>;
  onDelete: (message: Message) => void;
  onReact: (message: Message, key: ReactionKey) => void;
  onPin: (message: Message) => void;
  onRetry: (message: Message) => void;
  onTyping: () => void;
  onMessageUser: (username: string) => void;
  onDismissEdits: () => void;
}) {
  const { notify } = useDialog();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"pins" | "search" | "members" | "profile" | null>(null);
  const [showMembers, setShowMembers] = useState(true);
  useMinuteTick();

  const conversationId = active.kind === "dm" ? active.dm.id : active.channel.id;
  const isChannel = active.kind === "channel";
  const role = isChannel ? active.space.my_role : null;
  const canModerate = role === "owner" || role === "admin";
  const canPin = !isChannel || canModerate;

  // Ganti percakapan = reset mode balas/edit.
  useEffect(() => {
    setReplyTo(null);
    setEditing(null);
    setHighlight(null);
    setSheet(null);
  }, [conversationId]);

  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), 2200);
    return () => clearTimeout(timer);
  }, [highlight]);

  const mentionCandidates: AuthorRef[] = useMemo(
    () => members.filter((m) => m.username !== me).map((m) => ({ username: m.username, display_name: m.display_name })),
    [members, me]
  );

  const dm = active.kind === "dm" ? active.dm : null;
  const title = dm ? (dm.is_saved ? "Pesan Tersimpan" : dm.peer.display_name) : active.kind === "channel" ? active.channel.name : "";
  const online = !!dm && !dm.is_saved && dm.peer.online;
  const subtitle = typingName
    ? `${typingName} mengetik...`
    : dm
      ? dm.is_saved
        ? "Catatan pribadi, hanya kamu yang bisa melihat"
        : lastSeenLabel(dm.peer)
      : active.kind === "channel"
        ? active.channel.topic || `${active.space.name} · ${active.space.member_count} anggota`
        : "";

  const jumpTo = (id: number) => {
    if (state?.messages.some((m) => m.id === id && !m.deleted)) setHighlight(id);
    else notify("Pesan itu sudah lama. Gulir ke atas untuk memuat riwayat sebelumnya.", "error");
  };

  const pick = (message: Message) => {
    setSheet(null);
    jumpTo(message.id);
  };

  const editLast = () => {
    const mine = [...(state?.messages ?? [])].reverse().find((m) => m.author.username === me && !m.deleted);
    if (mine) {
      setReplyTo(null);
      setEditing(mine);
    }
  };

  const edits = state?.edits ?? [];
  const editors = [...new Set(edits.map((e) => e.author.display_name))];
  const headerButton = "flex h-10 w-10 shrink-0 items-center justify-center text-[#3B5A70] transition-colors hover:bg-[#EAF3F9] hover:text-[#072033]";

  return (
    <div className="chat-ui flex h-full min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col bg-white" aria-label={`Percakapan ${title}`}>
        <header className="flex h-[3.75rem] shrink-0 items-center gap-1 border-b-2 border-[#CFE2EE] bg-white px-1.5 sm:px-3">
          <button type="button" onClick={onBack} aria-label="Kembali ke daftar chat" className={`${headerButton} md:hidden`}>
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {/* Ketuk identitas untuk melihat profil (DM) atau anggota (channel). */}
          <button
            type="button"
            onClick={() => setSheet(dm ? (dm.is_saved ? null : "profile") : "members")}
            className="flex min-w-0 flex-1 items-center gap-2.5 py-1 pl-1 pr-2 text-left transition-colors hover:bg-[#F0F7FB]"
            aria-label={dm ? `Profil ${title}` : `Anggota ${title}`}
          >
            {dm ? (
              <Avatar name={title} seed={dm.peer.username} src={dm.peer.avatar} size="md" online={dm.is_saved ? undefined : dm.peer.online} saved={dm.is_saved} />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#EAF3F9] text-[#0369A1]">
                <Hash className="h-5 w-5" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0">
              <h2 className="truncate text-base font-bold leading-tight text-[#072033]">{title}</h2>
              <span
                className={`flex items-center gap-1.5 truncate text-[13px] leading-tight ${
                  typingName ? "font-semibold text-[#0369A1]" : online ? "font-medium text-[#15803D]" : "text-[#3B5A70]"
                }`}
              >
                {online && !typingName && <span className="h-2 w-2 shrink-0 bg-[#16A34A]" aria-hidden="true" />}
                <span className="truncate">{subtitle}</span>
              </span>
            </span>
          </button>
          <button type="button" onClick={() => setSheet("search")} aria-label="Cari pesan" title="Cari pesan" className={headerButton}>
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setSheet("pins")} aria-label="Pesan disematkan" title="Pesan disematkan" className={headerButton}>
            <Pin className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          {isChannel && (
            <button
              type="button"
              onClick={() => setShowMembers((v) => !v)}
              aria-pressed={showMembers}
              aria-label="Tampilkan anggota"
              title="Anggota"
              className={`${headerButton} hidden xl:flex ${showMembers ? "bg-[#EAF3F9] text-[#0369A1]" : ""}`}
            >
              <Users className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          )}
        </header>

        {edits.length > 0 && (
          <div className="menu-drop flex shrink-0 items-center gap-2 border-b-2 border-[#FDE68A] bg-[#FFFBEB] py-1.5 pl-3 pr-1" role="status">
            <Pencil className="h-4 w-4 shrink-0 text-[#A16207]" aria-hidden="true" />
            <button type="button" onClick={() => jumpTo(edits[0].id)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-semibold text-[#713F12]">
                {editors.slice(0, 2).join(", ")}
                {editors.length > 2 ? ` +${editors.length - 2}` : ""} mengedit {edits.length} pesan
              </span>
              <span className="block truncate text-[12px] text-[#854D0E]">&ldquo;{edits[0].preview}&rdquo; · ketuk untuk lihat</span>
            </button>
            <button type="button" onClick={onDismissEdits} aria-label="Tutup pemberitahuan edit" className="flex h-9 w-9 shrink-0 items-center justify-center text-[#A16207] hover:bg-[#FEF3C7]">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {!state || state.loading ? (
          <div className="flex flex-1 flex-col gap-3 p-4" style={wallpaper} aria-busy="true" aria-label="Memuat pesan">
            {[60, 40, 72, 52].map((w, i) => (
              <span key={i} className={`px-skeleton block h-11 ${i % 2 ? "self-end" : ""}`} style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : state.messages.filter((m) => !m.deleted).length === 0 && state.pending.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center" style={wallpaper}>
            <span className="px-icon h-16 w-16 bg-white">
              {isChannel ? (
                <Hash className="h-8 w-8" aria-hidden="true" />
              ) : (
                <Avatar name={title} seed={dm?.peer.username ?? ""} src={dm?.peer.avatar} size="lg" saved={!!dm?.is_saved} />
              )}
            </span>
            <p className="mt-3 text-base font-bold text-[#072033]">
              {isChannel ? `Selamat datang di #${title}` : dm?.is_saved ? "Simpan apa saja di sini" : `Mulai obrolan dengan ${title}`}
            </p>
            <p className="mt-1 max-w-xs text-sm text-[#3B5A70]">
              {isChannel ? "Ini awal channel. Sapa anggota lain, atau sebut teman dengan @username." : "Kirim pesan pertama di bawah."}
            </p>
          </div>
        ) : (
          <MessageList
            messages={state.pending.length ? [...state.messages, ...state.pending] : state.messages}
            me={me}
            kind={active.kind}
            canModerate={canModerate}
            canPin={canPin}
            peerLastReadId={dm && !dm.is_saved ? state.peerLastReadId : null}
            unreadFromId={state.unreadFromId}
            hasMore={state.hasMore}
            loadingOlder={state.loadingOlder}
            onLoadOlder={onLoadOlder}
            highlightId={highlight}
            typingName={typingName}
            onJump={jumpTo}
            wallpaper={wallpaper}
            actions={{
              onReply: (m) => {
                setEditing(null);
                setReplyTo(m);
              },
              onEdit: (m) => {
                setReplyTo(null);
                setEditing(m);
              },
              onDelete,
              onReact,
              onPin,
              onRetry,
              onCopy: async (m) => {
                try {
                  await navigator.clipboard.writeText(m.body);
                  notify("Pesan disalin", "success");
                } catch {
                  notify("Gagal menyalin pesan", "error");
                }
              },
            }}
          />
        )}

        <Composer
          placeholder={isChannel ? `Pesan ke #${title}` : dm?.is_saved ? "Tulis catatan" : "Ketik pesan"}
          replyTo={replyTo}
          editing={editing}
          me={me}
          mentionCandidates={mentionCandidates}
          onCancel={() => {
            setReplyTo(null);
            setEditing(null);
          }}
          onTyping={onTyping}
          onEditLast={editLast}
          onSubmit={async (text) => {
            if (editing) {
              if (text === editing.body) {
                setEditing(null);
                return true;
              }
              const ok = await onEdit(editing, text);
              if (ok) setEditing(null);
              return ok;
            }
            const ok = await onSend(text, replyTo);
            if (ok) setReplyTo(null);
            return ok;
          }}
        />
      </section>

      {isChannel && showMembers && (
        <aside className="scroll-slim hidden w-64 shrink-0 overflow-y-auto border-l-2 border-[#CFE2EE] bg-[#F7FAFC] p-3 xl:block" aria-label="Anggota ruang">
          <MemberList members={members} me={me} myRole={null} onMessage={onMessageUser} />
        </aside>
      )}

      <PinsSheet open={sheet === "pins"} conversationId={conversationId} me={me} onClose={() => setSheet(null)} onPick={pick} />
      <SearchSheet open={sheet === "search"} conversationId={conversationId} me={me} onClose={() => setSheet(null)} onPick={pick} />
      {dm && !dm.is_saved && (
        <ProfileCard open={sheet === "profile"} profile={dm.peer} onClose={() => setSheet(null)} />
      )}
      {active.kind === "channel" && (
        <SideSheet open={sheet === "members"} onClose={() => setSheet(null)} eyebrow={active.space.name} title="Anggota" titleId="social-members-title" width="md">
          <MemberList
            members={members}
            me={me}
            myRole={null}
            onMessage={(u) => {
              setSheet(null);
              onMessageUser(u);
            }}
          />
        </SideSheet>
      )}
    </div>
  );
}
