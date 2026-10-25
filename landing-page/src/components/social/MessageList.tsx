"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, ArrowDown, Check, CheckCheck, Clock3, MoreHorizontal, Pin, Reply, SmilePlus } from "lucide-react";
import { Avatar } from "@/components/social/Avatar";
import { Emoji, QUICK_REACTIONS, REACTION_LABEL } from "@/components/social/Emoji";
import { MessageBody } from "@/components/social/MessageBody";
import { MessageMenu, type MenuTarget } from "@/components/social/MessageMenu";
import { clockTime, dayLabel, type Message, type ReactionKey } from "@/lib/social";

const GROUP_WINDOW_MS = 5 * 60_000;
const SWIPE_TRIGGER = 56;
const SWIPE_MAX = 84;
const LONG_PRESS_MS = 420;
const DOUBLE_TAP_MS = 280;
const ENTER_MS = 450;
// Pesan yang isinya hanya 1-3 emoji tampil besar tanpa bubble (seperti Telegram).
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u;

export interface MessageActions {
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onReact: (message: Message, key: ReactionKey) => void;
  onPin: (message: Message) => void;
  onCopy: (message: Message) => void;
  onRetry: (message: Message) => void;
}

const keyOf = (m: Message) => m.clientKey ?? String(m.id);
const vibrate = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

function useSheetMenu() {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px), (pointer: coarse)");
    const update = () => setSheet(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return sheet;
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
  typingName,
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
  typingName: string | null;
  actions: MessageActions;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const prevHeight = useRef(0);
  const prevFirstKey = useRef<string | null>(null);
  const prevLastKey = useRef<string | null>(null);
  const oldestId = useRef<number>(Number.MAX_SAFE_INTEGER);
  // Pesan yang sudah ada saat percakapan dibuka tidak dianimasikan; hanya yang datang sesudahnya.
  const baseline = useRef<Set<string> | null>(null);
  // Waktu mulai animasi per bubble: tetap beranimasi walau versi server menggantikan bubble optimistis.
  const entered = useRef(new Map<string, number>());
  const [unseen, setUnseen] = useState(0);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const sheet = useSheetMenu();

  if (baseline.current === null) baseline.current = new Set(messages.map(keyOf));

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const firstKey = messages[0] ? keyOf(messages[0]) : null;
    const last = messages[messages.length - 1];
    const lastKey = last ? keyOf(last) : null;
    const prepended = prevFirstKey.current !== null && firstKey !== prevFirstKey.current && lastKey === prevLastKey.current;
    if (prepended) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
    } else if (lastKey !== prevLastKey.current) {
      const mine = last?.author.username === me;
      if (atBottom.current || mine || prevLastKey.current === null) {
        el.scrollTo({ top: el.scrollHeight, behavior: prevLastKey.current === null ? "auto" : "smooth" });
      } else {
        setUnseen((n) => n + 1);
      }
    }
    prevHeight.current = el.scrollHeight;
    prevFirstKey.current = firstKey;
    prevLastKey.current = lastKey;
    messages.forEach((m) => baseline.current?.add(keyOf(m)));
    if (messages[0] && messages[0].id > 0) oldestId.current = Math.min(oldestId.current, messages[0].id);
  }, [messages, me]);

  // Indikator mengetik muncul di bawah: tetap tempel kalau pengguna sedang di bawah.
  useEffect(() => {
    const el = scroller.current;
    if (el && typingName && atBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [typingName]);

  useEffect(() => {
    if (!highlightId) return;
    scroller.current?.querySelector(`[data-mid="${highlightId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setUnseen(0);
    if (el.scrollTop < 160 && hasMore && !loadingOlder) onLoadOlder();
  };

  const jumpToBottom = () => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    setUnseen(0);
  };

  const openMenu = useCallback((message: Message, rect: DOMRect, pickerOnly = false) => {
    setMenu({ message, rect, pickerOnly });
  }, []);

  const menuMessage = menu ? messages.find((m) => keyOf(m) === keyOf(menu.message)) ?? menu.message : null;
  const menuMine = menuMessage?.author.username === me;

  return (
    <div className="chat-ui relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="scroll-slim chat-wall h-full overflow-y-auto overflow-x-hidden overscroll-contain px-2 pb-2 pt-1 sm:px-5"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Riwayat pesan"
      >
        {hasMore ? (
          <div className="flex justify-center py-3">
            <button
              type="button"
              onClick={onLoadOlder}
              disabled={loadingOlder}
              className="px-chip bg-white px-3 py-1 text-xs font-semibold text-[#0369A1] disabled:opacity-60"
            >
              {loadingOlder ? "Memuat..." : "Muat pesan sebelumnya"}
            </button>
          </div>
        ) : (
          messages.length > 0 && (
            <p className="py-4 text-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#3B5A70]/70">
              Awal percakapan
            </p>
          )
        )}

        <ul>
          {messages.map((message, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(message.created_at);
            const sameAuthor = (a?: Message, b?: Message) =>
              !!a &&
              !!b &&
              !a.deleted &&
              a.author.username === b.author.username &&
              dayLabel(a.created_at) === dayLabel(b.created_at) &&
              Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < GROUP_WINDOW_MS;
            const grouped = !newDay && !message.reply_to && sameAuthor(prev, message);
            const lastInGroup = !(next && !next.reply_to && sameAuthor(message, next));
            const showUnread =
              unreadFromId !== null && message.id > unreadFromId && (!prev || prev.id <= unreadFromId) && message.author.username !== me;
            const key = keyOf(message);
            let animate = false;
            if (!baseline.current?.has(key) && !(message.id > 0 && message.id < oldestId.current)) {
              if (!entered.current.has(key)) entered.current.set(key, Date.now());
              animate = true;
            } else {
              const started = entered.current.get(key);
              animate = started !== undefined && Date.now() - started < ENTER_MS;
            }
            return (
              <li key={key}>
                {newDay && (
                  <div className="sticky top-1 z-10 my-2 flex justify-center">
                    <span className="bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#3B5A70] shadow-[0_0_0_2px_#CFE2EE] backdrop-blur">
                      {dayLabel(message.created_at)}
                    </span>
                  </div>
                )}
                {showUnread && (
                  <div className="my-3 flex items-center gap-2" role="separator">
                    <span className="h-0.5 flex-1 bg-[#BE123C]/30" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#BE123C]">Belum dibaca</span>
                    <span className="h-0.5 flex-1 bg-[#BE123C]/30" />
                  </div>
                )}
                <MessageItem
                  message={message}
                  me={me}
                  kind={kind}
                  grouped={grouped}
                  lastInGroup={lastInGroup}
                  animate={animate}
                  read={peerLastReadId !== null && message.id > 0 && message.id <= peerLastReadId}
                  highlighted={message.id === highlightId}
                  onMenu={openMenu}
                  actions={actions}
                />
              </li>
            );
          })}
        </ul>

        {typingName && (
          <div className="chat-in-other flex items-end gap-2 pt-2" aria-live="polite">
            {kind === "channel" && <span className="w-8 shrink-0" />}
            <div className="flex items-center gap-2 bg-white px-3 py-2.5 shadow-[0_0_0_2px_#CFE2EE]">
              <span className="flex items-center gap-1" aria-hidden="true">
                <span className="typing-dot h-1.5 w-1.5 bg-[#0369A1]" />
                <span className="typing-dot h-1.5 w-1.5 bg-[#0369A1]" />
                <span className="typing-dot h-1.5 w-1.5 bg-[#0369A1]" />
              </span>
              <span className="text-xs text-[#3B5A70]">{kind === "channel" ? `${typingName} mengetik` : "mengetik"}</span>
            </div>
          </div>
        )}
      </div>

      {unseen > 0 && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="menu-pop absolute bottom-3 right-3 inline-flex h-11 items-center gap-1.5 bg-[#072033] px-3.5 text-sm font-bold text-white shadow-[3px_3px_0_0_#0369A1] sm:right-5"
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
          {unseen} pesan baru
        </button>
      )}

      {menu && menuMessage && (
        <MessageMenu
          target={{ ...menu, message: menuMessage }}
          me={me}
          sheet={sheet}
          permissions={{ mine: menuMine, canPin, canDelete: menuMine || canModerate }}
          onClose={() => setMenu(null)}
          onReact={(key) => actions.onReact(menuMessage, key)}
          onReply={() => actions.onReply(menuMessage)}
          onCopy={() => actions.onCopy(menuMessage)}
          onPin={() => actions.onPin(menuMessage)}
          onEdit={() => actions.onEdit(menuMessage)}
          onDelete={() => actions.onDelete(menuMessage)}
          onRetry={() => actions.onRetry(menuMessage)}
        />
      )}
    </div>
  );
}

function MessageItem({
  message,
  me,
  kind,
  grouped,
  lastInGroup,
  animate,
  read,
  highlighted,
  onMenu,
  actions,
}: {
  message: Message;
  me: string;
  kind: "dm" | "channel";
  grouped: boolean;
  lastInGroup: boolean;
  animate: boolean;
  read: boolean;
  highlighted: boolean;
  onMenu: (message: Message, rect: DOMRect, pickerOnly?: boolean) => void;
  actions: MessageActions;
}) {
  const mine = message.author.username === me;
  const bubble = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; t: number; swiping: boolean; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const lastTap = useRef(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [burst, setBurst] = useState(0);
  const pending = !!message.local;
  const interactive = !message.deleted;
  const mentionsMe = !mine && !!me && new RegExp(`(^|[^\\w@])@${me}\\b`, "i").test(message.body);
  const jumbo = !message.reply_to && EMOJI_ONLY.test(message.body.trim());
  const showAuthor = kind === "channel" && !mine && !grouped;
  const showAvatar = kind === "channel" && !mine;

  const openMenu = (pickerOnly = false) => {
    if (bubble.current) onMenu(message, bubble.current.getBoundingClientRect(), pickerOnly);
  };

  const quickReact = (key: ReactionKey) => {
    if (pending) return;
    if (!message.reactions.some((r) => r.key === key && r.users.includes(me))) setBurst((n) => n + 1);
    actions.onReact(message, key);
  };

  /* -------- gestur sentuh: geser kanan = balas, tahan = menu, ketuk dua kali = suka -------- */
  const endGesture = (commit: boolean) => {
    const g = gesture.current;
    if (g?.timer) clearTimeout(g.timer);
    if (commit && g?.swiping && offset >= SWIPE_TRIGGER && !pending) actions.onReply(message);
    gesture.current = null;
    setDragging(false);
    setOffset(0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || !interactive) return;
    const timer = setTimeout(() => {
      vibrate(12);
      gesture.current = null;
      setOffset(0);
      openMenu();
    }, LONG_PRESS_MS);
    gesture.current = { x: e.clientX, y: e.clientY, t: Date.now(), swiping: false, timer };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      if (g.timer) clearTimeout(g.timer);
      g.timer = null;
    }
    if (!g.swiping) {
      if (dx > 12 && Math.abs(dx) > Math.abs(dy) * 1.4 && !pending) {
        g.swiping = true;
        setDragging(true);
      } else if (Math.abs(dy) > 12) {
        gesture.current = null; // scroll vertikal: lepaskan gestur.
        return;
      }
    }
    if (g.swiping) {
      // Hambatan makin terasa mendekati batas, seperti WhatsApp.
      const next = Math.min(SWIPE_MAX, dx < SWIPE_TRIGGER ? dx : SWIPE_TRIGGER + (dx - SWIPE_TRIGGER) * 0.3);
      if (offset < SWIPE_TRIGGER && next >= SWIPE_TRIGGER) vibrate(8);
      setOffset(Math.max(0, next));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (e.pointerType !== "mouse" && g && !g.swiping && Date.now() - g.t < 250) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        quickReact("heart");
      } else {
        lastTap.current = now;
      }
    }
    endGesture(true);
  };

  if (message.deleted) {
    return (
      <div data-mid={message.id} className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "pt-0.5" : "pt-2"}`}>
        <p className={`px-3 py-1.5 text-[13px] italic text-[#3B5A70]/80 shadow-[0_0_0_2px_#E4EEF4] ${showAvatar ? "ml-10" : ""}`}>
          Pesan ini sudah dihapus
        </p>
      </div>
    );
  }

  const status = mine && (
    message.local === "sending" ? (
      <Clock3 className="h-3.5 w-3.5" aria-label="Mengirim" />
    ) : message.local === "failed" ? (
      <AlertCircle className="h-3.5 w-3.5 text-[#BE123C]" aria-label="Gagal terkirim" />
    ) : kind === "dm" ? (
      read ? <CheckCheck className="h-3.5 w-3.5 text-[#0369A1]" aria-label="Sudah dibaca" /> : <Check className="h-3.5 w-3.5" aria-label="Terkirim" />
    ) : null
  );

  const meta = (
    <span className={`chat-time ml-2 inline-flex translate-y-1 items-center gap-1 whitespace-nowrap align-bottom text-[11px] ${jumbo ? "text-[#3B5A70]" : "text-[#3B5A70]/80"}`}>
      {message.edited_at && <span>diedit</span>}
      {clockTime(message.created_at)}
      {status}
    </span>
  );

  return (
    <div
      data-mid={message.id}
      className={`group/msg relative flex touch-pan-y items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${grouped ? "pt-0.5" : "pt-2.5"} ${
        animate ? (mine ? "chat-in-mine" : "chat-in-other") : ""
      } ${highlighted ? "chat-flash" : ""}`}
    >
      {/* Ikon balas yang muncul di belakang bubble saat digeser. */}
      <span
        className="pointer-events-none absolute left-1 top-1/2 flex h-8 w-8 items-center justify-center bg-[#0369A1] text-white"
        style={{ opacity: Math.min(1, offset / SWIPE_TRIGGER), transform: `translateY(-50%) scale(${0.5 + Math.min(1, offset / SWIPE_TRIGGER) * 0.5})` }}
        aria-hidden="true"
      >
        <Reply className="h-4 w-4" />
      </span>

      {showAvatar && (
        <span className="w-8 shrink-0 self-end">
          {lastInGroup && <Avatar name={message.author.display_name} seed={message.author.username} size="sm" />}
        </span>
      )}

      <div
        className={`relative flex min-w-0 max-w-[82%] flex-col sm:max-w-[68%] ${mine ? "items-end" : "items-start"}`}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: dragging ? "none" : "transform .24s cubic-bezier(.22,1,.36,1)" }}
      >
        {showAuthor && (
          <p className="mb-1 flex max-w-full items-baseline gap-1.5 px-0.5">
            <span className="truncate text-[13px] font-bold text-[#072033]">{message.author.display_name}</span>
            <span className="truncate text-[11px] text-[#3B5A70]">@{message.author.username}</span>
          </p>
        )}

        <div
          ref={bubble}
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-label={`Pesan dari ${mine ? "kamu" : message.author.display_name}, pukul ${clockTime(message.created_at)}. Tekan Enter untuk aksi.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => endGesture(false)}
          onContextMenu={(e) => {
            if ((e.target as HTMLElement).closest("a")) return;
            e.preventDefault();
            gesture.current = null;
            openMenu();
          }}
          onClick={(e) => {
            if (message.local === "failed" && !(e.target as HTMLElement).closest("a")) actions.onRetry(message);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ContextMenu") {
              e.preventDefault();
              openMenu();
            }
          }}
          className={`relative max-w-full select-text text-left outline-none [-webkit-touch-callout:none] focus-visible:shadow-[0_0_0_3px_#0369A1] [@media(pointer:coarse)]:select-none ${
            jumbo
              ? "px-1 py-0.5"
              : `px-3 pb-1.5 pt-2 ${
                  mentionsMe
                    ? "bg-[#FFFBEB] text-[#072033] shadow-[inset_3px_0_0_#F59E0B,0_0_0_2px_#FCD34D]"
                    : mine
                      ? "bg-[#D7E9F5] text-[#072033] shadow-[0_0_0_2px_#9CC6E0]"
                      : "bg-white text-[#072033] shadow-[0_0_0_2px_#D9E5ED]"
                }`
          } ${message.local === "failed" ? "cursor-pointer opacity-80" : ""} ${message.local === "sending" ? "opacity-90" : ""}`}
        >
          {message.pinned && (
            <span className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0369A1]">
              <Pin className="h-3 w-3" aria-hidden="true" /> Disematkan
            </span>
          )}
          {message.reply_to && (
            <span className="mb-1.5 block min-w-0 max-w-full border-l-[3px] border-[#0369A1] bg-[#0369A1]/[0.07] px-2.5 py-1">
              <span className="block truncate text-[13px] font-semibold text-[#0369A1]">{message.reply_to.author.display_name || "Pengguna"}</span>
              <span className="block truncate text-[13px] text-[#3B5A70]">{message.reply_to.deleted ? "Pesan dihapus" : message.reply_to.preview}</span>
            </span>
          )}
          <span className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${jumbo ? "text-[42px] leading-tight" : "text-[15px] leading-[1.45]"}`}>
            <MessageBody text={message.body} me={me} />
          </span>
          {meta}
          {message.local === "failed" && <span className="mt-1 block text-[12px] font-semibold text-[#BE123C]">Gagal terkirim. Ketuk untuk kirim ulang.</span>}

          {burst > 0 && (
            <span key={burst} className="heart-burst pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <Emoji name="heart" size={44} />
            </span>
          )}
        </div>

        {message.reactions.length > 0 && (
          <div className={`relative z-[1] mt-1 flex flex-wrap gap-1 px-0.5 ${mine ? "justify-end" : ""}`}>
            {message.reactions.map((reaction) => {
              const reacted = reaction.users.includes(me);
              return (
                <button
                  key={`${reaction.key}-${reaction.count}`}
                  type="button"
                  onClick={() => quickReact(reaction.key)}
                  title={`${REACTION_LABEL[reaction.key] ?? reaction.key}: ${reaction.users.map((u) => "@" + u).join(", ")}`}
                  aria-pressed={reacted}
                  aria-label={`${REACTION_LABEL[reaction.key] ?? reaction.key} ${reaction.count}`}
                  className={`react-pop inline-flex h-7 items-center gap-1 pl-1 pr-2 text-xs font-bold transition-[transform,background-color] duration-150 hover:-translate-y-0.5 ${
                    reacted ? "bg-[#DCEBF5] text-[#0369A1] shadow-[0_0_0_2px_#0369A1]" : "bg-white text-[#072033] shadow-[0_0_0_2px_#CFE2EE]"
                  }`}
                >
                  <Emoji name={reaction.key} size={18} />
                  <span className="chat-time">{reaction.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Desktop: toolbar cepat menempel di samping bubble saat hover (seperti Discord). */}
        {interactive && !pending && (
          <div
            className={`pointer-events-none absolute z-[2] hidden items-center gap-0.5 bg-white p-0.5 opacity-0 shadow-[0_0_0_2px_#CFE2EE,3px_3px_0_0_#E4EEF4] transition-opacity duration-150 group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 group-focus-within/msg:pointer-events-auto group-focus-within/msg:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:flex ${
              mine ? "left-1" : "right-1"
            } ${showAuthor ? "-top-2" : "-top-4"}`}
          >
            {QUICK_REACTIONS.slice(0, 3).map((key) => (
              <ToolbarButton key={key} label={REACTION_LABEL[key]} onClick={() => quickReact(key)}>
                <Emoji name={key} size={20} />
              </ToolbarButton>
            ))}
            <ToolbarButton label="Tambah reaksi" onClick={() => openMenu(true)}>
              <SmilePlus className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton label="Balas" onClick={() => actions.onReply(message)}>
              <Reply className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton label="Lainnya" onClick={() => openMenu()}>
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-8 w-8 items-center justify-center text-[#3B5A70] transition-[transform,background-color,color] duration-150 hover:scale-110 hover:bg-[#EAF3F9] hover:text-[#072033]"
    >
      {children}
    </button>
  );
}
