"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Hash, Pin, Search, Users } from "lucide-react";
import { useDialog } from "@/components/ConfirmDialog";
import { Avatar } from "@/components/social/Avatar";
import { Composer } from "@/components/social/Composer";
import { MessageList } from "@/components/social/MessageList";
import { MemberList, PinsSheet, SearchSheet } from "@/components/social/SocialSheets";
import { SideSheet } from "@/components/SideSheet";
import {
  lastSeenLabel,
  type AuthorRef,
  type ChannelItem,
  type DmItem,
  type Member,
  type Message,
  type ReactionKey,
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
}

export type ActiveConversation =
  | { kind: "dm"; dm: DmItem }
  | { kind: "channel"; channel: ChannelItem; space: SpaceItem };

export function ChatPane({
  active,
  state,
  me,
  typingName,
  members,
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
}: {
  active: ActiveConversation;
  state: ConversationState | undefined;
  me: string;
  typingName: string | null;
  members: Member[];
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
}) {
  const { notify } = useDialog();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"pins" | "search" | "members" | null>(null);
  const [showMembers, setShowMembers] = useState(true);

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

  const title = active.kind === "dm" ? (active.dm.is_saved ? "Pesan Tersimpan" : active.dm.peer.display_name) : active.channel.name;
  const subtitle =
    typingName
      ? `${typingName} sedang mengetik...`
      : active.kind === "dm"
        ? active.dm.is_saved
          ? "Catatan pribadi, hanya kamu yang bisa melihat"
          : `@${active.dm.peer.username} · ${lastSeenLabel(active.dm.peer)}`
        : active.channel.topic || active.space.name;

  const pick = (message: Message) => {
    setSheet(null);
    setHighlight(message.id);
  };

  const editLast = () => {
    const mine = [...(state?.messages ?? [])].reverse().find((m) => m.author.username === me && !m.deleted);
    if (mine) {
      setReplyTo(null);
      setEditing(mine);
    }
  };

  const headerButton = "flex h-10 w-10 shrink-0 items-center justify-center text-[#3B5A70] transition-colors hover:bg-[#EAF3F9] hover:text-[#072033]";

  return (
    <div className="chat-ui flex h-full min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col bg-white" aria-label={`Percakapan ${title}`}>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b-2 border-[#CFE2EE] bg-white px-2 sm:px-3">
          <button type="button" onClick={onBack} aria-label="Kembali ke daftar chat" className={`${headerButton} md:hidden`}>
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {active.kind === "dm" ? (
            <Avatar name={title} seed={active.dm.peer.username} size="sm" online={active.dm.is_saved ? undefined : active.dm.peer.online} saved={active.dm.is_saved} />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#EAF3F9] text-[#0369A1]">
              <Hash className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1 pl-1">
            <h2 className="truncate text-[15px] font-bold leading-tight text-[#072033]">{isChannel ? `# ${title}` : title}</h2>
            <p className={`truncate text-xs ${typingName ? "font-semibold text-[#0369A1]" : active.kind === "dm" && active.dm.peer.online ? "text-[#0F766E]" : "text-[#3B5A70]"}`}>
              {subtitle}
            </p>
          </div>
          <button type="button" onClick={() => setSheet("search")} aria-label="Cari pesan" title="Cari pesan" className={headerButton}>
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setSheet("pins")} aria-label="Pesan disematkan" title="Pesan disematkan" className={headerButton}>
            <Pin className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          {isChannel && (
            <>
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
              <button type="button" onClick={() => setSheet("members")} aria-label="Anggota" title="Anggota" className={`${headerButton} xl:hidden`}>
                <Users className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </>
          )}
        </header>

        {!state || state.loading ? (
          <div className="chat-wall flex flex-1 flex-col gap-3 p-4" aria-busy="true" aria-label="Memuat pesan">
            {[60, 40, 72, 52].map((w, i) => (
              <span key={i} className={`px-skeleton block h-10 ${i % 2 ? "self-end" : ""}`} style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : state.messages.length === 0 && state.pending.length === 0 ? (
          <div className="chat-wall flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="px-icon h-14 w-14">
              {isChannel ? <Hash className="h-7 w-7" aria-hidden="true" /> : <Avatar name={title} seed={active.kind === "dm" ? active.dm.peer.username : ""} saved={active.kind === "dm" && active.dm.is_saved} />}
            </span>
            <p className="mt-3 font-display text-base font-bold text-[#072033]">
              {isChannel ? `Selamat datang di #${title}` : active.kind === "dm" && active.dm.is_saved ? "Simpan apa saja di sini" : `Mulai obrolan dengan ${title}`}
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
            peerLastReadId={active.kind === "dm" && !active.dm.is_saved ? state.peerLastReadId : null}
            unreadFromId={state.unreadFromId}
            hasMore={state.hasMore}
            loadingOlder={state.loadingOlder}
            onLoadOlder={onLoadOlder}
            highlightId={highlight}
            typingName={typingName}
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
          placeholder={isChannel ? `Kirim pesan ke #${title}` : active.kind === "dm" && active.dm.is_saved ? "Tulis catatan" : `Pesan untuk ${title}`}
          replyTo={replyTo}
          editing={editing}
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
        <aside className="scroll-slim hidden w-60 shrink-0 overflow-y-auto border-l-2 border-[#CFE2EE] bg-[#F7FAFC] p-3 xl:block" aria-label="Anggota ruang">
          <MemberList members={members} me={me} myRole={null} onMessage={onMessageUser} />
        </aside>
      )}

      <PinsSheet open={sheet === "pins"} conversationId={conversationId} me={me} onClose={() => setSheet(null)} onPick={pick} />
      <SearchSheet open={sheet === "search"} conversationId={conversationId} me={me} onClose={() => setSheet(null)} onPick={pick} />
      {isChannel && (
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
