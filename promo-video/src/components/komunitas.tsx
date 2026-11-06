import React from "react";
import { Img, staticFile } from "remotion";
import {
  CalendarDays,
  Camera,
  Compass,
  Crown,
  ExternalLink,
  Hash,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  MoreVertical,
  Pin,
  PlayCircle,
  Plus,
  Search,
  SendHorizontal,
  Settings2,
  UserPlus,
  Users,
} from "lucide-react";
import { CHAT, MEMBERS, initials, toneFor, type ChatMsg } from "../data";
import { EASE_PX, blinkOn, clamp, prog } from "../lib/anim";

/**
 * Replika Mira Komunitas (components/social/*): rail ruang, daftar channel, chat pane,
 * dan panel anggota. Teks dirender dengan aturan MessageBody.tsx: *tebal*, _miring_,
 * dan link populer jadi chip berlabel (YouTube, WhatsApp, Instagram, link Mira).
 */

/* ------------------------------------------------------------------ avatar & ikon kecil */

export const Avatar: React.FC<{ name: string; seed: string; size?: number; online?: boolean }> = ({ name, seed, size = 32, online }) => {
  const tone = toneFor(seed);
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className="flex items-center justify-center font-mono font-bold"
        style={{ width: size, height: size, background: tone.bg, color: tone.fg, fontSize: size * 0.34, boxShadow: "2px 2px 0 0 #CFE2EE" }}
      >
        {initials(name)}
      </span>
      {online !== undefined && (
        <span className="absolute -bottom-0.5 -right-0.5 border-2 border-white" style={{ width: size * 0.3, height: size * 0.3, background: online ? "#16A34A" : "#9CC6E0" }} />
      )}
    </span>
  );
};

const TICKS: Record<"sending" | "sent", string> = {
  sending: "M4 1h4v1H4zM3 2h1v1H3zM8 2h1v1H8zM2 3h1v4H2zM9 3h1v4H9zM3 7h1v1H3zM8 7h1v1H8zM4 8h4v1H4zM6 3h1v3H6zM7 5h1v1H7z",
  sent: "M11 1h1v1h-1zM10 2h1v1h-1zM9 3h1v1H9zM8 4h1v1H8zM7 5h1v1H7zM6 6h1v1H6zM5 7h1v1H5zM4 6h1v1H4zM3 5h1v1H3zM2 4h1v1H2z",
};

const PixelTick: React.FC<{ state: "sending" | "sent" }> = ({ state }) => (
  <svg viewBox="0 0 14 10" width={14} height={11} shapeRendering="crispEdges" className="shrink-0">
    <path d={TICKS[state]} fill="#5F7F95" />
  </svg>
);

/* ------------------------------------------------------------------ teks pesan */

type Tone = { cls: string };
const TONES = {
  wa: "bg-[#25D366]/15 text-[#0B6B3A] shadow-[0_0_0_1.5px_#86DCA8]",
  red: "bg-[#FF0000]/10 text-[#B91C1C] shadow-[0_0_0_1.5px_#F9A8A8]",
  pink: "bg-[#E1306C]/10 text-[#9D174D] shadow-[0_0_0_1.5px_#F5A8C6]",
};

function linkChip(url: string, key: string) {
  if (url.includes("mira.muaraai.com/dashboard/jadwal")) {
    return (
      <span key={key} className="inline-flex max-w-full items-center gap-1.5 bg-[#0369A1]/10 px-2 py-0.5 align-middle text-[0.92em] font-semibold text-[#0369A1] shadow-[0_0_0_1.5px_#9CC6E0]">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Mira · Jadwal</span>
      </span>
    );
  }
  const meta = url.includes("youtu")
    ? { label: "YouTube", detail: "Video", Icon: PlayCircle, tone: TONES.red }
    : url.includes("whatsapp")
      ? { label: "WhatsApp", detail: "Undangan grup", Icon: MessageCircle, tone: TONES.wa }
      : { label: "Instagram", detail: "Postingan", Icon: Camera, tone: TONES.pink };
  return (
    <span key={key} className={`inline-flex max-w-full items-center gap-1.5 px-2 py-0.5 align-middle text-[0.92em] font-semibold ${meta.tone}`}>
      <meta.Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="shrink-0">{meta.label}</span>
      <span className="min-w-0 truncate font-normal opacity-80">{meta.detail}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
    </span>
  );
}

/** Format ala WhatsApp (subset MessageBody.tsx): *tebal*, _miring_, link -> chip. */
export function MessageText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /(https?:\/\/\S+)|\*([^*\n]+)\*|_([^_\n]+)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<React.Fragment key={`t${i++}`}>{text.slice(last, m.index)}</React.Fragment>);
    if (m[1]) parts.push(linkChip(m[1], `l${i++}`));
    else if (m[2]) parts.push(<strong key={`b${i++}`} className="font-bold">{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={`i${i++}`}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<React.Fragment key={`t${i++}`}>{text.slice(last)}</React.Fragment>);
  return <>{parts}</>;
}

/* ------------------------------------------------------------------ satu pesan */

const Bubble: React.FC<{
  msg: ChatMsg;
  mine?: boolean;
  showAuthor: boolean;
  showAvatar: boolean;
  tick?: "sending" | "sent";
  reaction?: { count: number; pop: number } | null;
  style?: React.CSSProperties;
}> = ({ msg, mine, showAuthor, showAvatar, tick, reaction, style }) => {
  const who = MEMBERS[msg.who];
  return (
    <div data-anchor={`msg-${msg.id}`} className={`relative flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${showAuthor ? "pt-4" : "pt-1.5"}`} style={style}>
      {!mine && <span className="w-8 shrink-0 self-end">{showAvatar && <Avatar name={who.name} seed={who.username} />}</span>}
      <div className={`relative flex min-w-0 max-w-[68%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {showAuthor && !mine && (
          <p className="mb-1 flex max-w-full items-baseline gap-1.5 px-0.5">
            <span className="truncate text-[13px] font-bold text-[#072033]">{who.name}</span>
            <span className="truncate text-[11px] text-[#3B5A70]">@{who.username}</span>
          </p>
        )}
        <div className={`relative max-w-full px-3.5 pb-2 pt-[9px] text-left ${mine ? "bg-[#D7E9F5] text-[#072033] shadow-[0_0_0_2px_#9CC6E0]" : "bg-white text-[#072033] shadow-[0_0_0_2px_#D9E5ED]"}`}>
          <span className="flex flex-wrap items-end gap-y-1">
            <span className="min-w-0 break-words text-[15px] leading-[1.5]">
              <MessageText text={msg.text} />
            </span>
            <span className="chat-time ml-auto inline-flex shrink-0 items-center gap-1 self-end whitespace-nowrap pl-2 text-[11px] leading-none text-[#5F7F95]">
              <span>{msg.time}</span>
              {tick && <PixelTick state={tick} />}
            </span>
          </span>
        </div>
        {reaction && (
          <div className="relative z-[1] mt-1 flex gap-1 px-0.5">
            <span
              className="inline-flex h-7 items-center gap-1 bg-white pl-1 pr-2 text-xs font-bold text-[#072033] shadow-[0_0_0_2px_#CFE2EE]"
              style={{ transform: `scale(${reaction.pop})`, transformOrigin: "0 50%" }}
            >
              <Img src={staticFile("emoji/fire.webp")} style={{ width: 18, height: 18 }} />
              <span className="chat-time">{reaction.count}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ aplikasi Komunitas desktop */

export interface KomunitasState {
  /** tinggi tiap pesan (untuk geser daftar ke atas dengan mulus saat pesan baru masuk) */
  heights: Record<string, number>;
  typing: boolean;
  composer: string;
  sendActive: boolean;
  mineAt: number | null;
  mineTick: "sending" | "sent";
  reactAt: number | null;
}

export const KomunitasApp: React.FC<{ t: number; s: KomunitasState }> = ({ t, s }) => {
  // Pesan yang terlihat dan progres kemunculannya.
  const items = CHAT.map((m) => ({ m, p: m.at === undefined ? 1 : prog(t, m.at, 0.34, EASE_PX) })).filter((x) => x.p > 0);
  const mineP = s.mineAt !== null ? prog(t, s.mineAt, 0.32, EASE_PX) : 0;
  const typingP = s.typing ? 1 : 0;
  // Pesan baru mendorong daftar ke atas: geser = tinggi pesan baru x (1 - progres).
  let lift = 0;
  for (const { m, p } of items) if (m.at !== undefined) lift += (s.heights[m.id] ?? 64) * (1 - p);
  if (mineP > 0) lift += (s.heights["mine"] ?? 64) * (1 - mineP);
  const reactPop = s.reactAt === null || t < s.reactAt ? 0 : (() => {
    const u = clamp((t - s.reactAt) / 0.34);
    return u < 0.6 ? 0.4 + (1.18 - 0.4) * (u / 0.6) : 1.18 - 0.18 * ((u - 0.6) / 0.4);
  })();

  return (
    <div data-anchor="kom-app" className="chat-ui flex h-full min-w-0 flex-row overflow-hidden bg-white shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#CFE2EE]">
      {/* Rail ruang */}
      <nav data-anchor="kom-rail" className="flex shrink-0 flex-col items-center gap-2 border-r-2 border-[#CFE2EE] bg-[#F0F7FB] px-2 py-3" style={{ width: 68 }}>
        <span data-anchor="kom-dm" className="flex h-11 w-11 items-center justify-center bg-white text-[#0369A1] shadow-[0_0_0_2px_#CFE2EE]">
          <MessagesSquare className="h-5 w-5" />
        </span>
        <span className="my-1 h-0.5 w-8 bg-[#CFE2EE]" />
        <span className="relative">
          <span className="absolute -left-2 top-1.5 h-8 w-1 bg-[#072033]" />
          <span className="flex h-11 w-11 -translate-x-px -translate-y-px items-center justify-center bg-[#072033] font-mono text-xs font-bold text-white shadow-[3px_3px_0_0_#0369A1]">K1</span>
        </span>
        <span className="relative flex h-11 w-11 items-center justify-center bg-white font-mono text-xs font-bold text-[#072033] shadow-[0_0_0_2px_#CFE2EE]">
          HI
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 border-2 border-[#EAF3F9] bg-[#0369A1]" />
        </span>
        <span className="flex h-11 w-11 items-center justify-center bg-white text-[#0F766E] shadow-[0_0_0_2px_#CFE2EE]">
          <Plus className="h-5 w-5" />
        </span>
        <span className="flex h-11 w-11 items-center justify-center bg-white text-[#0369A1] shadow-[0_0_0_2px_#CFE2EE]">
          <Compass className="h-5 w-5" />
        </span>
      </nav>

      {/* Daftar channel */}
      <div data-anchor="kom-list" className="flex min-h-0 flex-none flex-col border-r-2 border-[#CFE2EE] bg-white" style={{ width: 300 }}>
        <div className="flex h-14 shrink-0 items-center gap-2 border-b-2 border-[#CFE2EE] px-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-bold text-[#072033]" style={{ fontFamily: "Inter" }}>
              Kelas 1A.01
            </h2>
            <p className="truncate text-[11px] text-[#3B5A70]">32 anggota</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center text-[#0369A1]">
            <UserPlus className="h-[18px] w-[18px]" />
          </span>
          <span className="flex h-10 w-10 items-center justify-center text-[#3B5A70]">
            <Settings2 className="h-[18px] w-[18px]" />
          </span>
        </div>
        <div className="min-h-0 flex-1 p-2">
          <p className="mb-2 px-2 text-xs leading-relaxed text-[#3B5A70]">Ruang kelas 1A.01 Teknik Informatika.</p>
          <p className="mb-1 flex items-center gap-2 px-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#3B5A70]/80">
            <span className="h-1.5 w-1.5 bg-[#9CC6E0]" />
            Channel
          </p>
          <ul className="space-y-px">
            {[
              { name: "umum", active: true },
              { name: "tugas-kuliah", unread: true },
              { name: "info-kuliah", admin: true },
            ].map((c) => (
              <li key={c.name}>
                <span
                  className={`flex min-h-10 w-full items-center gap-2 px-2.5 text-[14px] ${
                    c.active ? "bg-[#DCEBF5] font-semibold text-[#072033] shadow-[inset_3px_0_0_#0369A1]" : c.unread ? "font-bold text-[#072033]" : "font-medium text-[#3B5A70]"
                  }`}
                >
                  {c.admin ? <Megaphone className="h-4 w-4 shrink-0" /> : <Hash className={`h-4 w-4 shrink-0 ${c.active ? "text-[#0369A1]" : ""}`} />}
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {c.unread && <span className="inline-flex h-5 min-w-5 items-center justify-center bg-[#0369A1] px-1 font-mono text-[10px] font-bold text-white">3</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t-2 border-[#CFE2EE] bg-[#F7FAFC] px-3 py-2">
          <Avatar name="Dinda" seed="dinda" size={40} online />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-[#072033]">Dinda</span>
            <span className="block truncate text-[11px] text-[#3B5A70]">@dinda</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#15803D]">
            <span className="h-2 w-2 bg-[#16A34A]" />
            Online
          </span>
        </div>
      </div>

      {/* Chat pane */}
      <section data-anchor="kom-chat" className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex h-[3.75rem] shrink-0 items-center gap-1 border-b-2 border-[#CFE2EE] bg-white px-3">
          <span className="flex min-w-0 flex-1 items-center gap-2.5 py-1 pl-1 pr-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#EAF3F9] text-[#0369A1]">
              <Hash className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold leading-tight text-[#072033]">umum</span>
              <span className="block truncate text-[13px] leading-tight text-[#3B5A70]">Obrolan umum anggota ruang</span>
            </span>
          </span>
          {[Search, Pin, MoreVertical].map((I, i) => (
            <span key={i} className="flex h-10 w-10 shrink-0 items-center justify-center text-[#3B5A70]">
              <I className="h-[18px] w-[18px]" />
            </span>
          ))}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#EAF3F9] text-[#0369A1]">
            <Users className="h-[18px] w-[18px]" />
          </span>
        </header>

        <div className="chat-wall relative min-h-0 flex-1 overflow-hidden px-6">
          <div className="absolute inset-x-6 bottom-3 flex flex-col" style={{ transform: `translateY(${lift}px)` }}>
            <div className="mb-1 mt-5 flex justify-center">
              <span className="bg-white/95 px-3 py-1 text-[12px] font-semibold text-[#3B5A70] shadow-[0_0_0_2px_#CFE2EE,2px_2px_0_0_#E4EEF4]">Senin, 9 November</span>
            </div>
            {items.map(({ m, p }, idx) => {
              const prev = items[idx - 1]?.m;
              const next = items[idx + 1]?.m;
              const first = !prev || prev.who !== m.who;
              const lastInGroup = !next || next.who !== m.who;
              return (
                <Bubble
                  key={m.id}
                  msg={m}
                  showAuthor={first}
                  showAvatar={lastInGroup}
                  reaction={m.id === "m1" && reactPop > 0 ? { count: 2, pop: reactPop } : null}
                  style={m.at !== undefined ? { opacity: p, transform: `translate(${(1 - p) * -10}px, ${(1 - p) * 6}px) scale(${0.96 + 0.04 * p})`, transformOrigin: "0 100%" } : undefined}
                />
              );
            })}
            {mineP > 0 && (
              <Bubble
                msg={{ id: "mine", who: "dinda", text: "Siap! Cek jadwal di https://mira.muaraai.com/dashboard/jadwal", time: "07.40" }}
                mine
                showAuthor
                showAvatar={false}
                tick={s.mineTick}
                style={{ opacity: mineP, transform: `translateY(${(1 - mineP) * 10}px) scale(${0.94 + 0.06 * mineP})`, transformOrigin: "100% 100%" }}
              />
            )}
            {typingP > 0 && (
              <div className="flex items-end gap-2 pt-2">
                <span className="w-8 shrink-0" />
                <div className="flex items-center gap-2 bg-white px-3 py-2.5 shadow-[0_0_0_2px_#CFE2EE]">
                  <span className="flex items-center gap-1">
                    {[0, 1, 2].map((d) => {
                      const ph = ((t - d * 0.15) % 1.1) / 1.1;
                      const up = ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI) : 0;
                      return <span key={d} className="h-1.5 w-1.5 bg-[#0369A1]" style={{ transform: `translateY(${-4 * up}px)`, opacity: 0.45 + 0.55 * up }} />;
                    })}
                  </span>
                  <span className="text-xs text-[#3B5A70]">Salsabila mengetik</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t-2 border-[#CFE2EE] bg-white px-4 pb-3 pt-2">
          <div className="flex items-end gap-2">
            <div data-anchor="kom-composer" className="px-input flex min-h-11 flex-1 items-center px-3 py-2.5 text-[15px] leading-snug text-[#072033]" data-focus={s.composer.length > 0 || undefined}>
              {s.composer ? <span className="truncate">{s.composer}</span> : <span className="text-[#3B5A70]/60">Pesan ke #umum</span>}
              {s.composer && <span style={{ width: 2, height: 18, background: "#072033", marginLeft: 2, opacity: blinkOn(t) ? 1 : 0, flex: "none" }} />}
            </div>
            <span
              data-anchor="kom-send"
              className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden ${
                s.sendActive ? "bg-[#0369A1] text-white shadow-[0_0_0_2px_#072033,3px_3px_0_0_#072033]" : "bg-[#EAF3F9] text-[#3B5A70] shadow-[0_0_0_2px_#CFE2EE]"
              }`}
            >
              <SendHorizontal className="h-5 w-5" />
            </span>
          </div>
        </div>
      </section>

      {/* Anggota */}
      <aside data-anchor="kom-members" className="w-64 shrink-0 border-l-2 border-[#CFE2EE] bg-[#F7FAFC] p-3">
        <div className="space-y-4">
          <div>
            <h4 className="mb-1 px-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#3B5A70]">Pemilik · 1</h4>
            <div className="flex items-center gap-2.5 px-1 py-1.5">
              <Avatar name={MEMBERS.raka.name} seed="raka" online />
              <span className="min-w-0">
                <span className="flex items-center gap-1 truncate text-sm font-semibold text-[#072033]">
                  {MEMBERS.raka.name}
                  <Crown className="h-3.5 w-3.5 shrink-0 text-[#9F1239]" />
                </span>
                <span className="block truncate font-mono text-[10px] text-[#3B5A70]">@raka</span>
              </span>
            </div>
          </div>
          <div>
            <h4 className="mb-1 px-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#3B5A70]">Anggota · 3</h4>
            {[MEMBERS.salsa, MEMBERS.dinda, MEMBERS.bima].map((m, i) => (
              <div key={m.username} className="flex items-center gap-2.5 px-1 py-1.5">
                <Avatar name={m.name} seed={m.username} online={i < 2} />
                <span className="min-w-0">
                  <span className={`block truncate text-sm font-semibold ${i < 2 ? "text-[#072033]" : "text-[#3B5A70]"}`}>{m.name}</span>
                  <span className="block truncate font-mono text-[10px] text-[#3B5A70]">@{m.username}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

export { Megaphone };
