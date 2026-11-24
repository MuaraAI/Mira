"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Topbar loading progress super ringan (GPU transform scaleX + opacity).
 * Mulai otomatis saat link internal diklik dan selesai halus saat route berganti.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef<number | null>(null);
  const prevPathRef = useRef(pathname);

  const clearTimers = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (doneRef.current !== null) {
      window.clearTimeout(doneRef.current);
      doneRef.current = null;
    }
  };

  useEffect(() => {
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;
    clearTimers();
    setState("done");
    doneRef.current = window.setTimeout(() => setState("idle"), 200);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
        return;
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) {
        return;
      }

      clearTimers();
      setState("loading");
      timerRef.current = window.setTimeout(() => {
        setState("done");
        doneRef.current = window.setTimeout(() => setState("idle"), 200);
      }, 6000);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, []);

  if (state === "idle") return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-[2.5px] overflow-hidden"
    >
      <div
        className={`h-full w-full origin-left bg-gradient-to-r from-[#0369A1] via-[#38BDF8] to-[#0EA5E9] will-change-transform ${
          state === "loading"
            ? "scale-x-[0.82] opacity-100 transition-transform duration-[1800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            : "scale-x-100 opacity-0 transition-[transform,opacity] duration-200 ease-out"
        }`}
      />
    </div>
  );
}
