"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pageRatios, renderPage } from "@/lib/pdf";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const GAP = 12;
const clamp = (v: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));

/**
 * Penampil PDF sendiri: halaman digambar saat mendekati layar, zoom dengan dua jari (pinch),
 * ketuk dua kali, tombol +/- atau Ctrl+scroll. Selama pinch, tampilan diperbesar lewat transform
 * (halus, tanpa render ulang) dan baru digambar tajam setelah jari diangkat, dengan titik
 * pusat zoom tetap di bawah jari.
 */
export function PdfViewer({ doc, active = true }: { doc: PDFDocumentProxy; active?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [baseWidth, setBaseWidth] = useState(0);
  const [ratios, setRatios] = useState<number[]>([]);
  const [current, setCurrent] = useState(1);
  const zoomRef = useRef(1);
  const anchor = useRef<{ cx: number; cy: number; px: number; py: number; ratio: number } | null>(null);

  zoomRef.current = zoom;

  // Lebar dasar = lebar area tampil (tanpa padding).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      setBaseWidth(Math.floor(el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    pageRatios(doc)
      .then((r) => alive && setRatios(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [doc]);

  const cssWidth = baseWidth * zoom;
  const ratioOf = useCallback((i: number) => ratios[i] ?? ratios[0] ?? 1.414, [ratios]);

  /** Terapkan zoom baru dan jaga titik (px,py) di layar tetap menunjuk isi yang sama. */
  const applyZoom = useCallback((next: number, px?: number, py?: number) => {
    const el = scrollRef.current;
    const target = clamp(next);
    if (!el || target === zoomRef.current) return;
    const x = px ?? el.clientWidth / 2;
    const y = py ?? el.clientHeight / 2;
    anchor.current = { cx: el.scrollLeft + x, cy: el.scrollTop + y, px: x, py: y, ratio: target / zoomRef.current };
    setZoom(target);
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const a = anchor.current;
    if (!el || !a) return;
    el.scrollLeft = a.cx * a.ratio - a.px;
    el.scrollTop = a.cy * a.ratio - a.py;
    anchor.current = null;
  }, [zoom]);

  // Gestur sentuh: pinch dua jari dan ketuk dua kali. Memakai event sentuh bawaan (non-passive)
  // supaya browser tidak ikut memperbesar halaman di belakang panel.
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;

    let pinch: { d0: number; z0: number; cx: number; cy: number; px: number; py: number; scale: number } | null = null;
    let lastTap = { t: 0, x: 0, y: 0 };

    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const middle = (t: TouchList) => {
      const rect = el.getBoundingClientRect();
      return { x: (t[0].clientX + t[1].clientX) / 2 - rect.left, y: (t[0].clientY + t[1].clientY) / 2 - rect.top };
    };

    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const m = middle(e.touches);
        pinch = { d0: distance(e.touches), z0: zoomRef.current, cx: el.scrollLeft + m.x, cy: el.scrollTop + m.y, px: m.x, py: m.y, scale: 1 };
        content.style.transformOrigin = `${pinch.cx}px ${pinch.cy}px`;
        content.style.willChange = "transform";
      }
    };
    const move = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const next = clamp((pinch.z0 * distance(e.touches)) / pinch.d0);
      pinch.scale = next / pinch.z0;
      content.style.transform = `scale(${pinch.scale})`;
    };
    const end = (e: TouchEvent) => {
      if (pinch && e.touches.length < 2) {
        const done = pinch;
        pinch = null;
        content.style.transform = "";
        content.style.willChange = "";
        applyZoom(done.z0 * done.scale, done.px, done.py);
        lastTap = { t: 0, x: 0, y: 0 };
        return;
      }
      if (e.touches.length === 0 && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        const now = Date.now();
        if (now - lastTap.t < 300 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 30) {
          const rect = el.getBoundingClientRect();
          applyZoom(zoomRef.current > 1.05 ? 1 : 2.2, t.clientX - rect.left, t.clientY - rect.top);
          lastTap = { t: 0, x: 0, y: 0 };
        } else {
          lastTap = { t: now, x: t.clientX, y: t.clientY };
        }
      }
    };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      applyZoom(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", end, { passive: true });
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("wheel", wheel);
    };
  }, [applyZoom]);

  // Nomor halaman yang sedang dilihat.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !baseWidth) return;
    let top = 0;
    const probe = el.scrollTop + el.clientHeight / 3;
    for (let i = 0; i < doc.numPages; i++) {
      top += ratioOf(i) * cssWidth + GAP;
      if (probe < top) return setCurrent(i + 1);
    }
    setCurrent(doc.numPages);
  }, [doc.numPages, baseWidth, cssWidth, ratioOf]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-dashed border-px-soft bg-white px-3 py-2">
        <span className="font-mono text-xs text-secondary" aria-live="polite">
          Hal. {current} / {doc.numPages}
        </span>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <button type="button" onClick={() => applyZoom(zoom / 1.4)} disabled={zoom <= MIN_ZOOM} aria-label="Perkecil" className="px-btn-ghost flex min-h-10 min-w-10 items-center justify-center">
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => applyZoom(1)} disabled={zoom === 1} aria-label="Pas lebar layar" className="px-btn-ghost flex min-h-10 min-w-14 items-center justify-center gap-1 px-2 font-mono text-xs font-bold">
            {zoom === 1 ? <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={() => applyZoom(zoom * 1.4)} disabled={zoom >= MAX_ZOOM} aria-label="Perbesar" className="px-btn-ghost flex min-h-10 min-w-10 items-center justify-center">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-[#E7EFF5] p-2 [touch-action:pan-x_pan-y] sm:p-3"
      >
        <div ref={contentRef} className="mx-auto" style={{ width: cssWidth || undefined }}>
          {baseWidth > 0 &&
            Array.from({ length: doc.numPages }, (_, i) => (
              <PageCanvas
                key={i}
                doc={doc}
                pageNumber={i + 1}
                width={cssWidth}
                height={ratioOf(i) * cssWidth}
                rootRef={scrollRef}
                active={active}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

/** Satu halaman: digambar saat dekat layar, dan hanya digambar ulang bila lebarnya berubah. */
function PageCanvas({
  doc,
  pageNumber,
  width,
  height,
  rootRef,
  active,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  height: number;
  rootRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(0); // lebar css saat terakhir digambar
  const [near, setNear] = useState(pageNumber <= 2);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { root: rootRef.current, rootMargin: "900px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootRef]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || width <= 0) return;
    if (!near) {
      // Jauh dari layar: lepaskan memori bitmap (hanya bila panel sedang terlihat).
      if (active && drawn.current) {
        el.width = 0;
        el.height = 0;
        drawn.current = 0;
      }
      return;
    }
    if (drawn.current === Math.round(width)) return;
    const job = renderPage(doc, pageNumber, el, width);
    job.promise.then(() => {
      drawn.current = Math.round(width);
    }).catch(() => {
      /* render dibatalkan saat zoom berubah atau panel ditutup */
    });
    return () => job.cancel();
  }, [near, width, doc, pageNumber, active]);

  return (
    <div ref={holder} className="mb-3 bg-white shadow-[3px_3px_0_0_#9CC6E0]" style={{ width, height }}>
      <canvas ref={canvas} className="block h-full w-full" role="img" aria-label={`Halaman ${pageNumber}`} />
    </div>
  );
}
