"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Reply, SendHorizontal, X } from "lucide-react";
import { Avatar } from "@/components/social/Avatar";
import { stripFormatting } from "@/components/social/MessageBody";
import { MAX_BODY, replyColor, type AuthorRef, type Message } from "@/lib/social";

const TYPING_THROTTLE_MS = 4000;

export function Composer({
  placeholder,
  replyTo,
  editing,
  me,
  mentionCandidates,
  onCancel,
  onSubmit,
  onTyping,
  onEditLast,
}: {
  placeholder: string;
  replyTo: Message | null;
  editing: Message | null;
  me: string;
  mentionCandidates: AuthorRef[];
  onCancel: () => void;
  onSubmit: (text: string) => Promise<boolean>;
  onTyping: () => void;
  onEditLast: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flying, setFlying] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);

  // Mode edit mengisi kotak dengan isi lama; balas/edit memindahkan fokus ke kotak.
  useEffect(() => {
    if (editing) setText(editing.body);
  }, [editing]);
  useEffect(() => {
    if (replyTo || editing) area.current?.focus();
  }, [replyTo, editing]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return mentionCandidates
      .filter((c) => c.username.startsWith(q) || c.display_name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mention, mentionCandidates]);

  const detectMention = (value: string, caret: number) => {
    const match = /(^|\s)@([a-zA-Z0-9_]{0,24})$/.exec(value.slice(0, caret));
    if (match && mentionCandidates.length) {
      setMention({ query: match[2], start: caret - match[2].length - 1 });
      setActiveIndex(0);
    } else {
      setMention(null);
    }
  };

  const insertMention = (username: string) => {
    if (!mention) return;
    const caret = area.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, mention.start)}@${username} ${text.slice(caret)}`;
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = mention.start + username.length + 2;
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    const value = text.trim();
    if (!value || sending || value.length > MAX_BODY) return;
    setSending(true);
    setFlying((n) => n + 1);
    const ok = await onSubmit(value);
    setSending(false);
    if (ok) {
      setText("");
      setMention(null);
      area.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[activeIndex].username);
        return;
      }
    }
    if (e.key === "Escape") {
      if (mention) setMention(null);
      else if (replyTo || editing) {
        setText(editing ? "" : text);
        onCancel();
      }
      return;
    }
    if (e.key === "ArrowUp" && !text && !editing) {
      e.preventDefault();
      onEditLast();
      return;
    }
    // Enter kirim, Shift+Enter baris baru (di HP keyboard virtual tetap pakai tombol kirim).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const over = text.length > MAX_BODY;
  const banner = editing ?? replyTo;
  const bannerTone = editing ? "#0369A1" : banner ? replyColor(banner.author.username) : "#0369A1";

  return (
    <div className="chat-ui relative shrink-0 border-t-[1px] border-[#DFECF4] bg-white px-2.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-4 lg:pb-3">
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Saran mention"
          className="menu-drop absolute bottom-full left-3 right-3 mb-1.5 max-h-60 overflow-y-auto rounded-[10px] border-[1px] border-[#D9E5ED] bg-white py-1 shadow-[0_12px_32px_-8px_rgba(7,32,51,0.16)] sm:left-4 sm:right-auto sm:w-72"
        >
          {suggestions.map((s, i) => (
            <li key={s.username} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(s.username)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === activeIndex ? "bg-[#E6F2FA]" : "hover:bg-[#F5F9FC]"}`}
              >
                <Avatar name={s.display_name} seed={s.username} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#072033]">{s.display_name}</span>
                  <span className="block truncate font-mono text-[11px] text-[#3B5A70]">@{s.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {banner && (
        <div
          key={banner.clientKey ?? banner.id}
          className="menu-drop mb-2 flex items-center gap-2.5 rounded-[8px] border-l-[3px] py-1.5 pl-2.5 pr-1"
          style={{ borderColor: bannerTone, background: `${bannerTone}10` }}
        >
          {editing ? (
            <Pencil className="h-[16px] w-[16px] shrink-0" style={{ color: bannerTone }} aria-hidden="true" />
          ) : (
            <Reply className="h-[16px] w-[16px] shrink-0" style={{ color: bannerTone }} aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold" style={{ color: bannerTone }}>
              {editing ? "Edit pesan" : `Membalas ${banner.author.username === me ? "diri sendiri" : banner.author.display_name}`}
            </span>
            <span className="block truncate text-[12.5px] text-[#3B5A70]">{stripFormatting(banner.body)}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (editing) setText("");
              onCancel();
            }}
            aria-label="Batalkan"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9999px] text-[#3B5A70] transition-colors hover:bg-white hover:text-[#072033]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor="social-composer">
          Tulis pesan
        </label>
        <textarea
          id="social-composer"
          ref={area}
          rows={1}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            detectMention(e.target.value, e.target.selectionStart);
            const now = Date.now();
            if (e.target.value && now - lastTyping.current > TYPING_THROTTLE_MS) {
              lastTyping.current = now;
              onTyping();
            }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setMention(null)}
          className="min-h-[42px] flex-1 resize-none rounded-[20px] border-[1px] border-[#D4E3EE] bg-[#F5F9FC] px-4 py-2.5 text-base leading-snug text-[#072033] outline-none transition-colors placeholder:text-[#648296] focus:border-[#0369A1] focus:bg-white sm:text-[14.5px]"
        />
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={submit}
          disabled={!text.trim() || sending || over}
          aria-label={editing ? "Simpan perubahan" : "Kirim pesan"}
          className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-[9999px] transition-[background-color,color,transform] duration-150 active:scale-95 disabled:cursor-not-allowed ${
            text.trim() && !over
              ? "bg-[#072033] text-white hover:bg-[#0369A1]"
              : "bg-[#EAF3F9] text-[#648296]"
          }`}
        >
          <SendHorizontal key={flying} className={`h-[18px] w-[18px] ${flying ? "send-fly" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {text.length > MAX_BODY - 200 && (
        <p className={`mt-1 text-right font-mono text-[10px] ${over ? "font-bold text-[#BE123C]" : "text-[#3B5A70]"}`}>
          {text.length}/{MAX_BODY}
        </p>
      )}
    </div>
  );
}
