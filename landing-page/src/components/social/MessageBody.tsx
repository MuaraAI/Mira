"use client";

import { Fragment } from "react";

// Satu regex untuk tiga token: `kode`, URL http(s), dan @mention.
const TOKEN_RE = /(`[^`\n]{1,200}`)|(https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"])|((?<![\w@])@[a-zA-Z0-9_]{3,24})/g;

/** Render teks pesan tanpa HTML mentah: link aman, mention disorot, kode inline. */
export function MessageBody({ text, me }: { text: string; me?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const [token, code, url, mention] = match;
    if (code) {
      parts.push(
        <code key={index} className="bg-[#EAF3F9] px-1 py-px font-mono text-[0.85em] text-[#072033]">
          {code.slice(1, -1)}
        </code>
      );
    } else if (url) {
      parts.push(
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="break-all font-medium text-[#0369A1] underline decoration-2 underline-offset-2 hover:text-[#075985]"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
    } else if (mention) {
      const isMe = me && mention.slice(1).toLowerCase() === me.toLowerCase();
      parts.push(
        <span
          key={index}
          className={`px-0.5 font-semibold ${isMe ? "bg-[#FCD34D]/60 text-[#072033]" : "bg-[#DCEBF5] text-[#0369A1]"}`}
        >
          {mention}
        </span>
      );
    } else {
      parts.push(token);
    }
    last = index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
    </>
  );
}
