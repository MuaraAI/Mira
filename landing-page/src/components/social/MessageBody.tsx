"use client";

import { createContext, Fragment, useContext, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { SpaceTile } from "@/components/social/Avatar";
import { inviteCodeFrom, mediaUrl, socialApi, toneFor, type InvitePreview } from "@/lib/social";

/* ------------------------------------------------------------------ link internal (SPA) */

export interface SocialLinkHandlers {
  /** Link ke halaman Mira sendiri: navigasi di dalam app, tanpa reload. */
  openInternal: (pathWithQuery: string) => void;
  /** Link undangan grup: buka preview / gabung di dalam app. */
  openInvite: (code: string) => void;
}

export const SocialLinkContext = createContext<SocialLinkHandlers | null>(null);

function internalPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const own = typeof window !== "undefined" && parsed.origin === window.location.origin;
    if ((own || parsed.hostname === "mira.muaraai.com") && parsed.pathname.startsWith("/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {}
  return null;
}

/* ------------------------------------------------------------------ inline (ala WhatsApp) */

// Urutan penting: kode dulu (isi kode tidak diformat), lalu link, mention, baru penekanan.
const INLINE: { kind: "code" | "url" | "mention" | "bold" | "italic" | "strike"; re: RegExp }[] = [
  { kind: "code", re: /`([^`\n]{1,300})`/ },
  { kind: "url", re: /https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"]/ },
  { kind: "mention", re: /(?<![\w@])@[a-zA-Z0-9_]{3,24}\b/ },
  { kind: "bold", re: /(?<![\w*])\*(?=\S)([^*\n]{0,300}?\S)\*(?![\w*])/ },
  { kind: "italic", re: /(?<![\w_])_(?=\S)([^_\n]{0,300}?\S)_(?![\w_])/ },
  { kind: "strike", re: /(?<![\w~])~(?=\S)([^~\n]{0,300}?\S)~(?![\w~])/ },
];

function Inline({ text, me, depth = 0 }: { text: string; me?: string; depth?: number }) {
  const links = useContext(SocialLinkContext);
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    let best: { kind: (typeof INLINE)[number]["kind"]; match: RegExpExecArray } | null = null;
    for (const { kind, re } of INLINE) {
      if (depth > 2 && (kind === "bold" || kind === "italic" || kind === "strike")) continue;
      const match = re.exec(rest);
      if (match && (!best || match.index < best.match.index)) best = { kind, match };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    const { kind, match } = best;
    if (match.index > 0) out.push(rest.slice(0, match.index));
    const token = match[0];
    const inner = match[1] ?? token;
    const k = key++;
    if (kind === "code") {
      out.push(
        <code key={k} className="bg-[#072033]/[0.07] px-1 py-px font-mono text-[0.88em] text-[#072033]">
          {inner}
        </code>
      );
    } else if (kind === "url") {
      const path = internalPath(token);
      const invite = inviteCodeFrom(token);
      out.push(
        <a
          key={k}
          href={token}
          target={path ? undefined : "_blank"}
          rel={path ? undefined : "noopener noreferrer nofollow"}
          className="break-all font-medium text-[#0369A1] underline decoration-[#0369A1]/40 decoration-2 underline-offset-2 hover:decoration-[#0369A1]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (!links || !path) return;
            e.preventDefault();
            if (invite) links.openInvite(invite);
            else links.openInternal(path);
          }}
        >
          {token}
        </a>
      );
    } else if (kind === "mention") {
      const isMe = !!me && token.slice(1).toLowerCase() === me.toLowerCase();
      out.push(
        <span key={k} className={`px-0.5 font-semibold ${isMe ? "bg-[#FCD34D]/60 text-[#072033]" : "bg-[#DCEBF5] text-[#0369A1]"}`}>
          {token}
        </span>
      );
    } else {
      const Tag = kind === "bold" ? "strong" : kind === "italic" ? "em" : "s";
      out.push(
        <Tag key={k} className={kind === "bold" ? "font-bold" : kind === "strike" ? "opacity-70" : ""}>
          <Inline text={inner} me={me} depth={depth + 1} />
        </Tag>
      );
    }
    rest = rest.slice(match.index + token.length);
  }
  return (
    <>
      {out.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ blok */

type Block =
  | { type: "p"; lines: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[]; start: number }
  | { type: "pre"; code: string };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");
  const last = () => blocks[blocks.length - 1];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      const opener = line.trimStart().slice(3);
      // ```satu baris``` juga didukung.
      if (opener.endsWith("```") && opener.length > 3) {
        blocks.push({ type: "pre", code: opener.slice(0, -3) });
        continue;
      }
      if (opener) code.push(opener);
      i++;
      while (i < lines.length && !lines[i].trimEnd().endsWith("```")) code.push(lines[i++]);
      if (i < lines.length) {
        const closing = lines[i].trimEnd().slice(0, -3);
        if (closing) code.push(closing);
      }
      blocks.push({ type: "pre", code: code.join("\n") });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    const bullet = /^\s*[-*•]\s+(.+)$/.exec(line);
    const ordered = /^\s*(\d{1,3})[.)]\s+(.+)$/.exec(line);
    const prev = last();
    if (quote) {
      if (prev?.type === "quote") prev.lines.push(quote[1]);
      else blocks.push({ type: "quote", lines: [quote[1]] });
    } else if (bullet) {
      if (prev?.type === "ul") prev.items.push(bullet[1]);
      else blocks.push({ type: "ul", items: [bullet[1]] });
    } else if (ordered) {
      if (prev?.type === "ol") prev.items.push(ordered[2]);
      else blocks.push({ type: "ol", items: [ordered[2]], start: Number(ordered[1]) });
    } else if (prev?.type === "p") {
      prev.lines.push(line);
    } else {
      blocks.push({ type: "p", lines: [line] });
    }
  }
  return blocks;
}

function Lines({ lines, me }: { lines: string[]; me?: string }) {
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          <Inline text={line} me={me} />
        </Fragment>
      ))}
    </>
  );
}

/** Render teks pesan tanpa HTML mentah: format ala WhatsApp, link aman, mention disorot. */
export function MessageBody({ text, me }: { text: string; me?: string }) {
  const blocks = parseBlocks(text);
  return (
    <span className="flex flex-col gap-1.5">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "pre":
            return (
              <pre
                key={i}
                className="scroll-slim max-w-full overflow-x-auto whitespace-pre bg-[#072033]/[0.06] px-2.5 py-2 font-mono text-[13px] leading-relaxed text-[#072033] shadow-[inset_2px_0_0_#9CC6E0]"
              >
                {block.code}
              </pre>
            );
          case "quote":
            return (
              <span key={i} className="block border-l-[3px] border-[#5FA3CC] bg-[#0369A1]/[0.05] py-0.5 pl-2.5 pr-1 text-[#3B5A70]">
                <Lines lines={block.lines} me={me} />
              </span>
            );
          case "ul":
            return (
              <span key={i} className="flex flex-col gap-0.5">
                {block.items.map((item, j) => (
                  <span key={j} className="flex gap-2">
                    <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 bg-[#0369A1]" aria-hidden="true" />
                    <span className="min-w-0">
                      <Inline text={item} me={me} />
                    </span>
                  </span>
                ))}
              </span>
            );
          case "ol":
            return (
              <span key={i} className="flex flex-col gap-0.5">
                {block.items.map((item, j) => (
                  <span key={j} className="flex gap-2">
                    <span className="chat-time min-w-[1.25rem] shrink-0 font-semibold text-[#0369A1]">{block.start + j}.</span>
                    <span className="min-w-0">
                      <Inline text={item} me={me} />
                    </span>
                  </span>
                ))}
              </span>
            );
          default:
            return (
              <span key={i} className="block">
                <Lines lines={block.lines} me={me} />
              </span>
            );
        }
      })}
    </span>
  );
}

/** Teks polos tanpa penanda format, untuk preview satu baris (daftar chat, kutipan balasan). */
export function stripFormatting(text: string): string {
  return text
    .replace(/```/g, "")
    // Penanda kutipan & list, termasuk di teks yang barisnya sudah diratakan server.
    .replace(/(^|\s)>\s?/g, "$1")
    .replace(/(^|\s)[-*•]\s+/g, "$1")
    .replace(/(^|\s)\d{1,3}[.)]\s+/g, "$1")
    .replace(/(?<![\w*])\*(\S[^*\n]*?)\*(?![\w*])/g, "$1")
    .replace(/(?<![\w_])_(\S[^_\n]*?)_(?![\w_])/g, "$1")
    .replace(/(?<![\w~])~(\S[^~\n]*?)~(?![\w~])/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");
}

/* ------------------------------------------------------------------ kartu undangan grup */

const inviteCache = new Map<string, Promise<InvitePreview | null>>();

function loadInvite(code: string) {
  let cached = inviteCache.get(code);
  if (!cached) {
    cached = socialApi.invite(code).then((r) => r.space).catch(() => null);
    inviteCache.set(code, cached);
  }
  return cached;
}

export function forgetInvite(code: string) {
  inviteCache.delete(code);
}

/** Link undangan pertama di pesan, untuk kartu preview di bawah teks. */
export function firstInviteCode(text: string): string | null {
  for (const match of text.matchAll(/https?:\/\/[^\s<>()]+/g)) {
    const code = inviteCodeFrom(match[0].replace(/[).,!?;:'"]+$/, ""));
    if (code) return code;
  }
  return null;
}

export function InviteCard({ code }: { code: string }) {
  const links = useContext(SocialLinkContext);
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    loadInvite(code).then((p) => alive && setPreview(p));
    return () => {
      alive = false;
    };
  }, [code]);

  if (preview === undefined) {
    return <span className="px-skeleton mt-2 block h-[120px] w-full min-w-[220px]" aria-hidden="true" />;
  }
  if (preview === null) {
    return (
      <span className="mt-2 block bg-[#F7FAFC] px-3 py-2 text-[13px] text-[#3B5A70] shadow-[0_0_0_2px_#E4EEF4]">
        Undangan grup sudah tidak berlaku
      </span>
    );
  }
  const banner = mediaUrl(preview.banner);
  const tone = toneFor(`space-${preview.id}`);
  return (
    <span
      className="mt-2 block w-full min-w-[220px] max-w-[320px] overflow-hidden bg-white text-left shadow-[0_0_0_2px_#9CC6E0,4px_4px_0_0_#DCEBF5]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span
        className="block h-16 bg-cover bg-center"
        style={banner ? { backgroundImage: `url(${banner})` } : { background: `repeating-linear-gradient(135deg, ${tone.bg} 0 10px, ${tone.bg}dd 10px 20px)` }}
        aria-hidden="true"
      />
      <span className="flex items-end gap-3 px-3">
        <span className="-mt-6 shadow-[0_0_0_3px_#fff]">
          <SpaceTile name={preview.name} src={preview.avatar} active={false} />
        </span>
        <span className="min-w-0 flex-1 pt-1.5">
          <span className="block truncate text-[15px] font-bold text-[#072033]">{preview.name}</span>
        </span>
      </span>
      <span className="block px-3 pb-3 pt-1">
        {preview.description && <span className="line-clamp-2 block text-[13px] text-[#3B5A70]">{preview.description}</span>}
        <span className="mt-1.5 flex items-center gap-3 text-[12px] text-[#3B5A70]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[#16A34A]" aria-hidden="true" />
            {preview.online_count} online
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {preview.member_count} anggota
          </span>
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            links?.openInvite(code);
          }}
          className={`mt-2.5 flex h-10 w-full items-center justify-center text-sm font-bold transition-[background-color,transform] active:translate-y-px ${
            preview.joined
              ? "bg-[#EAF3F9] text-[#0369A1] shadow-[0_0_0_2px_#9CC6E0] hover:bg-[#DCEBF5]"
              : "bg-[#0369A1] text-white shadow-[0_0_0_2px_#072033,3px_3px_0_0_#072033] hover:bg-[#075985]"
          }`}
        >
          {preview.joined ? "Buka grup" : "Gabung grup"}
        </button>
      </span>
    </span>
  );
}
