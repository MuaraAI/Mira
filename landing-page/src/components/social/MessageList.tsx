"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Check,
  CheckCheck,
  Copy,
  Flame,
  Frown,
  Heart,
  Laugh,
  Pencil,
  Pin,
  PinOff,
  Reply,
  SmilePlus,
  Sparkles,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { Avatar } from "@/components/social/Avatar";
import { MessageBody } from "@/components/social/MessageBody";
import { clockTime, dayLabel, type Message, type ReactionKey } from "@/lib/social";

export const REACTIONS: { key: ReactionKey; label: string; icon: typeof Heart }[] = [
  { key: "up", label: "Setuju", icon: ThumbsUp },
  { key: "heart", label: "Suka", icon: Heart },
  { key: "haha", label: "Lucu", icon: Laugh },
  { key: "wow", label: "Keren", icon: Sparkles },
  { key: "fire", label: "Mantap", icon: Flame },
  { key: "sad", label: "Sedih", icon: Frown },
];
const REACTION_MAP = Object.fromEntries(REACTIONS.map((r) => [r.key, r])) as Record<ReactionKey, (typeof REACTIONS)[number]>;

const GROUP_WINDOW_MS = 5 * 60_000;

export interface MessageActions {
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onReact: (message: Message, key: ReactionKey) => void;
  onPin: (message: Message) => void;
  onCopy: (message: Message) => void;
}

export function MessageList({
  messages,
  me,
  kind,
  canModerate,
  canPin,
  peerLastReadId,
  unreadFromId,
  hasMore,
  loadingOlder,
  onLoadOlder,
  highlightId,
  actions,
}: {
  messages: Message[];
  me: string;
  kind: "dm" | "channel";
  canModerate: boolean;
  canPin: boolean;
  peerLastReadId: number | null;
  unreadFromId: number | null;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  highlightId: number | null;
  actions: MessageActions;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const prevHeight = useRef(0);
  const prevFirstId = useRef<number | null>(null);
  const prevLastId = useRef<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showJump, setShowJump] = useState(false);

  // Jaga posisi scroll: tempel ke bawah untuk pesan baru, pertahankan posisi saat memuat pesan lama.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const firstId = messages[0]?.id ?? null;
    const lastId = messages[messages.length - 1]?.id ?? null;
    const prependedOlder = prevFirstId.current !== null && firstId !== null && firstId < prevFirstId.current;
    if (prependedOlder) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
    } else if (lastId !== prevLastId.current) {
      const mine = messages[messages.length - 1]?.author.username === me;
      if (atBottom.current || mine || prevLastId.current === null) {
        el.scrollTop = el.scrollHeight;
      } else {
        setShowJump(true);
      }
    }
    prevHeight.current = el.scrollHeight;
    prevFirstId.current = firstId;
    prevLastId.current = lastId;
  }, [messages, me]);

  useEffect(() => {
    if (!highlightId) return;
    scroller.current?.querySelector(`[data-mid="${highlightId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setShowJump(false);
    if (el.scrollTop < 120 && hasMore && !loadingOlder) onLoadOlder();
  };

  const jumpToBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowJump(false);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="scroll-slim h-full overflow-y-auto overflow-x-hidden overscroll-contain bg-[#F7FAFC] px-3 py-3 sm:px-5"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Riwayat pesan"
      >
        {hasMore ? (
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={onLoadOlder}
              disabled={loadingOlder}
              className="px-chip bg-white px-3 py-1 font-mono text-[11px] font-semibold text-[#0369A1] disabled:opacity-60"
            >
              {loadingOlder ? "Memuat..." : "Muat pesan sebelumnya"}
            </button>
          </div>
        ) : (
          messages.length > 0 && (
            <p className="py-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#3B5A70]/70">
              Awal percakapan
            </p>
          )
        )}

        <ul className="space-y-0.5">
          {messages.map((message, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(message.created_at);
            const grouped =
              !!prev &&
              !newDay &&
              !message.reply_to &&
              !prev.deleted &&
              prev.author.username === message.author.username &&
              new Date(message.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS;
            const showUnread = unreadFromId !== null && message.id > unreadFromId && (!prev || prev.id <= unreadFromId) && message.author.username !== me;
            return (
              <li key={message.id}>
                {newDay && (
                  <div className="my-3 flex justify-center">
                    <span className="px-chip bg-white px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#3B5A70]">
                      {dayLabel(message.created_at)}
                    </span>
                  </div>
                )}
                {showUnread && (
                  <div className="my-2 flex items-center gap-2" role="separator">
                    <span className="h-0.5 flex-1 bg-[#BE123C]/40" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#BE123C]">Belum dibaca</span>
                    <span className="h-0.5 flex-1 bg-[#BE123C]/40" />
                  </div>
                )}
                <MessageItem
                  message={message}
                  me={me}
                  kind={kind}
                  grouped={grouped}
                  read={peerLastReadId !== null && message.id <= peerLastReadId}
                  canModerate={canModerate}
                  canPin={canPin}
                  highlighted={message.id === highlightId}
                  selected={selected === message.id}
                  onSelect={() => setSelected((s) => (s === message.id ? null : message.id))}
                  onDeselect={() => setSelected(null)}
                  actions={actions}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {showJump && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="px-btn absolute bottom-3 right-4 inline-flex h-10 items-center gap-1.5 px-3 font-mono text-xs font-bold"
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
          Pesan baru
        </button>
      )}
    </div>
  );
}

function MessageItem({
  message,
  me,
  kind,
  grouped,
  read,
  canModerate,
  canPin,
  highlighted,
  selected,
  onSelect,
  onDeselect,
  actions,
}: {
  message: Message;
  me: string;
  kind: "dm" | "channel";
  grouped: boolean;
  read: boolean;
  canModerate: boolean;
  canPin: boolean;
  highlighted: boolean;
  selected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  actions: MessageActions;
}) {
  const mine = message.author.username === me;
  const mentionsMe = !mine && new RegExp(`(^|[^\\w@])@${me}\\b`, "i").test(message.body);
  const showAuthor = kind === "channel" && !mine && !grouped;
  const [picker, setPicker] = useState(false);
  // Setiap aksi dari menu langsung menutup menu, supaya daftar pesan tetap bersih.
  const run = (fn: (message: Message) => void) => () => {
    setPicker(false);
    onDeselect();
    fn(message);
  };

  if (message.deleted) {
    return (
      <div data-mid={message.id} className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "" : "pt-1.5"}`}>
        <p className={`px-3 py-1.5 font-mono text-[11px] italic text-[#3B5A70]/80 ${kind === "channel" && !mine ? "ml-10" : ""}`}>
          Pesan ini sudah dihapus
        </p>
      </div>
    );
  }

  return (
    <div
      data-mid={message.id}
      className={`group/msg relative flex gap-2 ${mine ? "flex-row-reverse" : ""} ${grouped ? "pt-0.5" : "pt-2"}`}
    >
      {kind === "channel" && !mine && (
        <span className="w-8 shrink-0">
          {!grouped && <Avatar name={message.author.display_name} seed={message.author.username} size="sm" />}
        </span>
      )}

      <div className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[72%] ${mine ? "items-end" : "items-start"}`}>
        {showAuthor && (
          <p className="mb-0.5 flex items-baseline gap-2 px-0.5">
            <span className="truncate text-[13px] font-bold text-[#072033]">{message.author.display_name}</span>
            <span className="truncate font-mono text-[10px] text-[#3B5A70]">@{message.author.username}</span>
          </p>
        )}

        <div
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          aria-label={`Pesan dari ${message.author.display_name}, pukul ${clockTime(message.created_at)}. Tekan untuk aksi.`}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) return;
            onSelect();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
          className={`relative max-w-full cursor-pointer select-text px-3 py-2 text-left text-[14px] leading-relaxed outline-none transition-[box-shadow,background-color] duration-200 focus-visible:shadow-[0_0_0_3px_#0369A1] ${
            mine
              ? "bg-[#DCEBF5] text-[#072033] shadow-[0_0_0_2px_#9CC6E0]"
              : "bg-white text-[#072033] shadow-[0_0_0_2px_#CFE2EE]"
          } ${mentionsMe ? "shadow-[inset_3px_0_0_#FCD34D,0_0_0_2px_#FCD34D]" : ""} ${
            highlighted ? "shadow-[0_0_0_3px_#0369A1]" : ""
          }`}
        >
          {message.pinned && (
            <span className="mb-1 flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#0369A1]">
              <Pin className="h-3 w-3" aria-hidden="true" /> Disematkan
            </span>
          )}
          {message.reply_to && (
            <span className="mb-1.5 block min-w-0 max-w-full border-l-[3px] border-[#0369A1] bg-[#0369A1]/[0.06] px-2 py-1">
              <span className="block truncate text-[12px] font-bold text-[#0369A1]">
                {message.reply_to.author.display_name || "Pengguna"}
              </span>
              <span className="block truncate text-[12px] text-[#3B5A70]">
                {message.reply_to.deleted ? "Pesan dihapus" : message.reply_to.preview}
              </span>
            </span>
          )}
          <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            <MessageBody text={message.body} me={me} />
          </span>
          <span className="ml-2 inline-flex translate-y-0.5 items-center gap-1 whitespace-nowrap align-bottom font-mono text-[10px] text-[#3B5A70]/80">
            {message.edited_at && <span>diedit</span>}
            {clockTime(message.created_at)}
            {mine && kind === "dm" && (read ? (
              <CheckCheck className="h-3.5 w-3.5 text-[#0369A1]" aria-label="Sudah dibaca" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-label="Terkirim" />
            ))}
          </span>
        </div>

        {message.reactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>
            {message.reactions.map((reaction) => {
              const meta = REACTION_MAP[reaction.key];
              if (!meta) return null;
              const reacted = reaction.users.includes(me);
              const Icon = meta.icon;
              return (
                <button
                  key={reaction.key}
                  type="button"
                  onClick={() => actions.onReact(message, reaction.key)}
                  title={`${meta.label}: ${reaction.users.map((u) => "@" + u).join(", ")}`}
                  aria-pressed={reacted}
                  aria-label={`${meta.label} ${reaction.count}`}
                  className={`inline-flex h-7 items-center gap-1 px-2 font-mono text-[11px] font-bold transition-colors ${
                    reacted
                      ? "bg-[#0369A1] text-white shadow-[0_0_0_2px_#0369A1]"
                      : "bg-white text-[#072033] shadow-[0_0_0_2px_#CFE2EE] hover:shadow-[0_0_0_2px_#5FA3CC]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {reaction.count}
                </button>
              );
            })}
          </div>
        )}

        {(selected || picker) && (
          <div className={`menu-drop mt-1.5 flex flex-wrap items-center gap-1 ${mine ? "justify-end" : ""}`}>
            {REACTIONS.map(({ key, label, icon: Icon }) => (
              <ActionButton key={key} label={label} onClick={run((m) => actions.onReact(m, key))}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </ActionButton>
            ))}
            <span className="mx-0.5 h-5 w-0.5 bg-[#CFE2EE]" aria-hidden="true" />
            <ActionButton label="Balas" onClick={run(actions.onReply)}>
              <Reply className="h-4 w-4" aria-hidden="true" />
            </ActionButton>
            <ActionButton label="Salin" onClick={run(actions.onCopy)}>
              <Copy className="h-4 w-4" aria-hidden="true" />
            </ActionButton>
            {canPin && (
              <ActionButton label={message.pinned ? "Lepas sematan" : "Sematkan"} onClick={run(actions.onPin)}>
                {message.pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
              </ActionButton>
            )}
            {mine && (
              <ActionButton label="Edit" onClick={run(actions.onEdit)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </ActionButton>
            )}
            {(mine || canModerate) && (
              <ActionButton label="Hapus" danger onClick={run(actions.onDelete)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </ActionButton>
            )}
          </div>
        )}
      </div>

      {/* Desktop: aksi cepat muncul saat hover, seperti Discord. */}
      {!selected && (
        <div
          className={`pointer-events-none absolute top-0 hidden items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 lg:flex ${
            mine ? "left-0" : "right-0"
          }`}
        >
          <ActionButton label="Reaksi" onClick={() => setPicker((p) => !p)}>
            <SmilePlus className="h-4 w-4" aria-hidden="true" />
          </ActionButton>
          <ActionButton label="Balas" onClick={() => actions.onReply(message)}>
            <Reply className="h-4 w-4" aria-hidden="true" />
          </ActionButton>
          {mine && (
            <ActionButton label="Edit" onClick={() => actions.onEdit(message)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-9 w-9 items-center justify-center bg-white shadow-[0_0_0_2px_#CFE2EE] transition-colors lg:h-8 lg:w-8 ${
        danger ? "text-[#BE123C] hover:bg-[#FFF1F2]" : "text-[#072033] hover:bg-[#EAF3F9] hover:text-[#0369A1]"
      }`}
    >
      {children}
    </button>
  );
}
