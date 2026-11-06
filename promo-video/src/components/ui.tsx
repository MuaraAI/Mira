import React, { useLayoutEffect, useState } from "react";
import { Img, staticFile } from "remotion";
import { Check, Loader2, Lock, X } from "lucide-react";
import { blinkOn } from "../lib/anim";

/* Logo Mira: /logo/logo.png (sama dengan Monogram.tsx). */
export const Monogram: React.FC<{ size: number }> = ({ size }) => (
  <Img src={staticFile("logo/logo.png")} style={{ width: size, height: size, objectFit: "contain" }} />
);

export function GithubIcon() {
  return (
    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/** Loader2 lucide yang berputar berdasarkan waktu (animate-spin versi per-frame). */
export const Spin: React.FC<{ t: number; className?: string }> = ({ t, className = "h-4 w-4" }) => (
  <Loader2 className={className} style={{ transform: `rotate(${(t * 360) % 360}deg)` }} aria-hidden="true" />
);

/** Kursor kotak berkedip (.px-cursor) */
export const BlinkBlock: React.FC<{ t: number; className?: string; style?: React.CSSProperties }> = ({ t, className, style }) => (
  <span className={className} style={{ ...style, opacity: blinkOn(t) ? 1 : 0 }} aria-hidden="true" />
);

/* ------------------------------------------------------------------ */
/* Bingkai browser bergaya Mira (bar atas = panel fitur di hero Mira)  */
/* ------------------------------------------------------------------ */

export const BROWSER_W = 1440;
export const BROWSER_H = 900;
export const CHROME_H = 46;

export const BrowserFrame: React.FC<{
  url: string;
  caret?: boolean;
  t: number;
  children: React.ReactNode;
  urlRef?: string;
}> = ({ url, caret, t, children }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: BROWSER_W,
      height: BROWSER_H + CHROME_H,
      background: "#fff",
      boxShadow: "0 -2px 0 0 #163A55, 0 2px 0 0 #163A55, -2px 0 0 0 #163A55, 2px 0 0 0 #163A55, 14px 14px 0 0 #CFE2EE",
    }}
  >
    <div
      style={{ height: CHROME_H, background: "#EAF3F9", borderBottom: "2px solid #CFE2EE", display: "flex", alignItems: "center", gap: 8, padding: "0 18px" }}
    >
      <span style={{ width: 12, height: 12, background: "#BE123C" }} />
      <span style={{ width: 12, height: 12, background: "#FCD34D" }} />
      <span style={{ width: 12, height: 12, background: "#0F766E" }} />
      <div
        data-anchor="urlbar"
        style={{
          marginLeft: 26,
          height: 30,
          width: 620,
          background: "#fff",
          boxShadow: "0 -2px 0 0 #CFE2EE, 0 2px 0 0 #CFE2EE, -2px 0 0 0 #CFE2EE, 2px 0 0 0 #CFE2EE",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
        }}
      >
        <Lock className="h-3.5 w-3.5" style={{ color: "#0F766E" }} aria-hidden="true" />
        <span className="font-mono" style={{ fontSize: 14, color: "#072033", whiteSpace: "pre" }}>
          {url}
        </span>
        {caret && <BlinkBlock t={t} style={{ width: 2, height: 16, background: "#0369A1", marginLeft: -6 }} />}
      </div>
    </div>
    <div style={{ position: "relative", width: BROWSER_W, height: BROWSER_H, overflow: "hidden", background: "#F7FAFC" }}>{children}</div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Komponen kecil dashboard (disalin dari dashboard-ui.tsx)            */
/* ------------------------------------------------------------------ */

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6 border-b-2 border-dashed border-px-soft pb-5">
      <h1 className="flex items-center gap-3 text-3xl font-display font-bold tracking-tight text-foreground">
        <span className="h-2.5 w-2.5 shrink-0 bg-[#0369A1] shadow-[3px_3px_0_0_#9CC6E0]" aria-hidden="true" />
        {title}
      </h1>
      {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-secondary">{description}</p>}
    </div>
  );
}

export type StepState = "pending" | "running" | "done" | "failed";

/** StepIcon dari AuthPortal.tsx: kotak hijau berisi centang, kotak berkedip 2x2 saat berjalan. */
export function StepIcon({ state, t }: { state: StepState; t: number }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#0F766E] text-white shadow-[2px_2px_0_0_#072033]">
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#BE123C] text-white shadow-[2px_2px_0_0_#072033]">
        <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (state === "running") {
    // .login-step-running: 4 sel menyala bergiliran (urutan 1, 2, 4, 3), 0.8s per putaran.
    const order = [0, 1, 3, 2];
    const active = order[Math.floor(((t % 0.8) + 0.8) % 0.8 / 0.2)];
    return (
      <span
        className="grid h-6 w-6 shrink-0 grid-cols-2 gap-[2px] p-[3px] shadow-[0_-2px_0_0_#0369A1,0_2px_0_0_#0369A1,-2px_0_0_0_#0369A1,2px_0_0_0_#0369A1]"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ background: i === active ? "#0369A1" : "#CFE2EE" }} />
        ))}
      </span>
    );
  }
  return <span className="h-6 w-6 shrink-0 bg-white shadow-[0_-2px_0_0_#CFE2EE,0_2px_0_0_#CFE2EE,-2px_0_0_0_#CFE2EE,2px_0_0_0_#CFE2EE]" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Anchor: ukur posisi elemen [data-anchor] relatif ke root (tanpa      */
/* terpengaruh transform kamera), supaya kursor & kamera tepat sasaran. */
/* ------------------------------------------------------------------ */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useAnchors(rootRef: React.RefObject<HTMLElement | null>) {
  const [anchors, setAnchors] = useState<Record<string, Rect>>({});
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const next: Record<string, Rect> = {};
    root.querySelectorAll<HTMLElement>("[data-anchor]").forEach((el) => {
      let x = 0;
      let y = 0;
      let node: HTMLElement | null = el;
      while (node && node !== root) {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      next[el.dataset.anchor as string] = { x, y, w: el.offsetWidth, h: el.offsetHeight };
    });
    const a = JSON.stringify(next);
    if (a !== JSON.stringify(anchors)) setAnchors(next);
  });
  return anchors;
}

/** Titik tengah anchor (fallback aman bila belum terukur). */
export function mid(a: Rect | undefined, fx = 0.5, fy = 0.5, fallback = { x: 0, y: 0 }) {
  if (!a) return fallback;
  return { x: a.x + a.w * fx, y: a.y + a.h * fy };
}
