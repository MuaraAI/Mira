"use client";

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Hero parallax bergaya casamomo.at dengan lerp halus: latar samudra bergeser & zoom lembut,
 * sementara copy hero melayang keluar saat halaman di-scroll.
 */
export function ParallaxHero({
  children,
  className = "",
  ariaLabelledBy,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabelledBy?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;

    const bg = root.querySelector<HTMLElement>("[data-parallax-bg]");
    const fg = root.querySelector<HTMLElement>("[data-parallax-fg]");
    let raf = 0;
    let current = 0;
    let target = 0;

    const readTarget = () => {
      const rect = root.getBoundingClientRect();
      const height = Math.max(rect.height, 1);
      target = Math.min(1, Math.max(0, -rect.top / height));
    };

    const apply = (p: number) => {
      const mobile = window.innerWidth < 768;
      if (bg) {
        const shift = mobile ? 52 : 110;
        const zoom = mobile ? 0.05 : 0.1;
        bg.style.transform = `translate3d(0, ${(p * shift).toFixed(2)}px, 0) scale(${(
          1 +
          p * zoom
        ).toFixed(4)})`;
      }
      if (fg) {
        const fgShift = mobile ? -22 : -42;
        fg.style.transform = `translate3d(0, ${(p * fgShift).toFixed(2)}px, 0)`;
        fg.style.opacity = String(Math.max(0.22, 1 - p * 0.75).toFixed(3));
      }
    };

    const tick = () => {
      raf = 0;
      readTarget();
      const delta = target - current;
      if (Math.abs(delta) < 0.0008) {
        current = target;
        apply(current);
        return;
      }
      current += delta * 0.14;
      apply(current);
      raf = window.requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(tick);
    };

    readTarget();
    current = target;
    apply(current);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <section ref={ref} className={className} aria-labelledby={ariaLabelledBy}>
      {children}
    </section>
  );
}

/**
 * Layer parallax serbaguna dengan interpolasi lerp halus saat elemen melintasi viewport.
 */
export function ParallaxLayer({
  children,
  speed = 18,
  desktopOnly = false,
  className = "",
}: {
  children: React.ReactNode;
  speed?: number;
  desktopOnly?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || speed === 0 || prefersReducedMotion()) return;

    let raf = 0;
    let current = 0;
    let target = 0;

    const readTarget = () => {
      if (desktopOnly && window.innerWidth < 768) {
        target = 0;
        return;
      }
      const rect = node.getBoundingClientRect();
      const vh = Math.max(window.innerHeight, 1);
      const progress = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
      target = (progress - 0.5) * speed * -2;
    };

    const apply = (offset: number) => {
      node.style.transform =
        offset === 0 ? "translate3d(0, 0, 0)" : `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    };

    const tick = () => {
      raf = 0;
      readTarget();
      const delta = target - current;
      if (Math.abs(delta) < 0.05) {
        current = target;
        apply(current);
        return;
      }
      current += delta * 0.12;
      apply(current);
      raf = window.requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(tick);
    };

    readTarget();
    current = target;
    apply(current);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [speed, desktopOnly]);

  return (
    <div ref={ref} data-parallax-layer className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
}

/** Teks yang menyala kata demi kata dengan lerp halus mengikuti posisi scroll. */
export function ScrubRevealText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(" ");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>("[data-scrub-word]"));
    if (prefersReducedMotion()) {
      spans.forEach((span) => {
        span.style.opacity = "1";
      });
      return;
    }

    let raf = 0;
    let current = 0;
    let target = 0;

    const readTarget = () => {
      const rect = el.getBoundingClientRect();
      const vh = Math.max(window.innerHeight, 1);
      const start = vh * 0.9;
      const end = vh * 0.38;
      target = Math.min(1, Math.max(0, (start - rect.top) / Math.max(start - end, 1)));
    };

    const apply = (progress: number) => {
      const total = spans.length;
      spans.forEach((span, idx) => {
        const wordStart = (idx / total) * 0.72;
        const wordProgress = Math.min(1, Math.max(0, (progress - wordStart) / 0.28));
        span.style.opacity = String((0.26 + 0.74 * wordProgress).toFixed(3));
      });
    };

    const tick = () => {
      raf = 0;
      readTarget();
      const delta = target - current;
      if (Math.abs(delta) < 0.002) {
        current = target;
        apply(current);
        return;
      }
      current += delta * 0.16;
      apply(current);
      raf = window.requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(tick);
    };

    readTarget();
    current = target;
    apply(current);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [text]);

  return (
    <p ref={ref} className={className}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} data-scrub-word className="scrub-word" style={{ opacity: 0.26 }}>
          {word}
          {index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

/** Bingkai terpotong dengan parallax vertikal lerp halus pada konten di dalamnya. */
export function ParallaxFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = ref.current;
    if (!frame || prefersReducedMotion()) return;
    const inner = frame.querySelector<HTMLElement>("[data-parallax-inner]");
    if (!inner) return;

    let raf = 0;
    let current = 0;
    let target = 0;

    const readTarget = () => {
      const rect = frame.getBoundingClientRect();
      const vh = Math.max(window.innerHeight, 1);
      const progress = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
      const travel = window.innerWidth < 768 ? 18 : 32;
      target = (progress - 0.5) * -travel;
    };

    const apply = (offset: number) => {
      inner.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0) scale(1.06)`;
    };

    const tick = () => {
      raf = 0;
      readTarget();
      const delta = target - current;
      if (Math.abs(delta) < 0.05) {
        current = target;
        apply(current);
        return;
      }
      current += delta * 0.14;
      apply(current);
      raf = window.requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(tick);
    };

    readTarget();
    current = target;
    apply(current);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <div data-parallax-inner className="will-change-transform">
        {children}
      </div>
    </div>
  );
}

/** Muncul halus saat masuk atau sudah melewati viewport. */
export function RevealOnScroll({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefersReducedMotion()) {
      setRevealed(true);
      return;
    }

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -20px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-revealed={revealed}
      className={`parallax-reveal ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
