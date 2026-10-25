"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "mira_chat_sidebar_width";

/** Lebar kolom daftar chat di desktop; null = pakai default responsif (264px tablet, 320px desktop). */
export function useSidebarWidth(min = 240, max = 480) {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (saved >= min && saved <= max) setWidth(saved);
    } catch {}
  }, [min, max]);

  const commit = useCallback((next: number | null) => {
    setWidth(next);
    try {
      if (next === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(next));
    } catch {}
  }, []);

  return { width, setWidth, commit, min, max };
}

/**
 * Pegangan geser di antara daftar chat dan percakapan (desktop/tablet).
 * Geser dengan mouse/sentuh, panah kiri/kanan untuk keyboard, klik dua kali untuk ukuran awal.
 */
export function ResizeHandle({
  width,
  min,
  max,
  targetRef,
  onResize,
  onCommit,
}: {
  width: number | null;
  min: number;
  max: number;
  /** Elemen kolom yang diubah lebarnya (dipakai sebagai titik nol posisi pointer). */
  targetRef: React.RefObject<HTMLElement | null>;
  onResize: (width: number) => void;
  onCommit: (width: number | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const latest = useRef<number | null>(width);
  latest.current = width;

  const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)));
  const current = () => latest.current ?? targetRef.current?.getBoundingClientRect().width ?? min;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !targetRef.current) return;
    const left = targetRef.current.getBoundingClientRect().left;
    onResize(clamp(e.clientX - left));
  };

  const stop = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    onCommit(latest.current);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Ubah lebar daftar chat"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(current())}
      tabIndex={0}
      title="Geser untuk mengubah lebar. Klik dua kali untuk ukuran awal."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={() => onCommit(null)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const next = clamp(current() + (e.key === "ArrowRight" ? 16 : -16));
        onResize(next);
        onCommit(next);
      }}
      className="group relative z-10 -ml-[5px] -mr-[5px] hidden w-[10px] shrink-0 cursor-col-resize touch-none outline-none md:block"
    >
      {/* Garis tipis yang menyala biru saat di-hover/digeser, menimpa border kolom. */}
      <span
        className={`absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 transition-colors duration-150 ${
          dragging ? "bg-[#0369A1]" : "bg-transparent group-hover:bg-[#5FA3CC] group-focus-visible:bg-[#0369A1]"
        }`}
        aria-hidden="true"
      />
      <span
        className={`absolute left-1/2 top-1/2 flex h-10 w-[10px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 bg-white shadow-[0_0_0_2px_#9CC6E0] transition-opacity duration-150 ${
          dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        }`}
        aria-hidden="true"
      >
        <span className="h-0.5 w-1 bg-[#0369A1]" />
        <span className="h-0.5 w-1 bg-[#0369A1]" />
        <span className="h-0.5 w-1 bg-[#0369A1]" />
      </span>
    </div>
  );
}
