"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  /** Teks kecil di bawah label, contoh "Selasa 07:30-10:00". */
  sub?: string;
  /** Penanda singkat, contoh "Hari Ini". */
  badge?: string;
}

/**
 * Dropdown pixel pengganti <select> bawaan browser: daftar opsi tampil di halaman (bukan di
 * picker sistem), bisa dipakai dengan keyboard (panah, Home/End, Enter, Esc, ketik huruf awal)
 * dan membuka ke atas bila ruang di bawah tidak cukup.
 */
export function Dropdown({
  options,
  value,
  onChange,
  ariaLabel,
  caption,
  className = "",
  menuClassName = "",
}: {
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Nama dropdown untuk pembaca layar. */
  ariaLabel: string;
  /** Judul kecil di dalam tombol (di atas nilai terpilih). */
  caption?: string;
  className?: string;
  menuClassName?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selectedIndex);
  const current = options[selectedIndex];

  const openMenu = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const room = window.innerHeight - rect.bottom;
      // Ruang kurang dari tinggi menu (maks 18rem) dan lebih lega di atas -> buka ke atas.
      setOpenUp(room < 300 && rect.top > room);
    }
    setActive(selectedIndex);
    setOpen(true);
  }, [selectedIndex]);

  const close = useCallback(() => setOpen(false), []);

  const choose = useCallback(
    (index: number) => {
      const option = options[index];
      if (option) onChange(option.value);
      setOpen(false);
    },
    [options, onChange],
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (!options.length) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) return openMenu();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (i + step + options.length) % options.length);
        break;
      }
      case "Home":
      case "End":
        if (open) {
          event.preventDefault();
          setActive(event.key === "Home" ? 0 : options.length - 1);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(active);
        else openMenu();
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        break;
      case "Tab":
        close();
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const letter = event.key.toLowerCase();
          const start = open ? active + 1 : selectedIndex + 1;
          const order = [...options.keys()].map((n) => (start + n) % options.length);
          const hit = order.find((i) => options[i].label.toLowerCase().startsWith(letter));
          if (hit !== undefined) {
            if (open) setActive(hit);
            else onChange(options[hit].value);
          }
        }
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className="px-input flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          {caption && (
            <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-secondary">{caption}</span>
          )}
          <span className="block truncate text-sm font-bold text-foreground">{current?.label ?? "-"}</span>
        </span>
        {current?.badge && (
          <span className="shrink-0 bg-[#0F766E] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">{current.badge}</span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#0369A1] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={ariaLabel}
          className={`px-frame page-in absolute inset-x-0 z-50 max-h-72 overflow-y-auto overscroll-contain bg-white p-1 [--px-line:#163A55] shadow-[4px_4px_0_0_#CFE2EE] ${
            openUp ? "bottom-full mb-2" : "top-full mt-2"
          } ${menuClassName}`}
        >
          {options.map((o, i) => {
            const selected = o.value === current?.value;
            return (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                  i === active ? "bg-px-highlight" : ""
                } ${selected ? "font-bold text-[#0369A1]" : "text-foreground"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words">{o.label}</span>
                  {o.sub && <span className="block truncate font-mono text-[11px] font-normal text-secondary">{o.sub}</span>}
                </span>
                {o.badge && (
                  <span className="shrink-0 bg-[#0F766E]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#0F766E]">{o.badge}</span>
                )}
                {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
