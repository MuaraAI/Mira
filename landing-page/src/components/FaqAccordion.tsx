"use client";

import { useId, useState } from "react";

export interface FaqItem {
  q: string;
  a: string;
}

export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const baseId = useId();
  const [openMap, setOpenMap] = useState<Record<number, boolean>>({});

  function toggle(index: number) {
    setOpenMap((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  return (
    <div className="space-y-3 sm:space-y-3.5">
      {items.map(({ q, a }, index) => {
        const open = Boolean(openMap[index]);
        const buttonId = `${baseId}-btn-${index}`;
        const panelId = `${baseId}-panel-${index}`;

        return (
          <div
            key={q}
            className={`overflow-hidden rounded-[10px] border-[1px] bg-white transition-colors duration-200 ${
              open ? "border-[#0369A1]" : "border-stroke"
            }`}
          >
            <button
              id={buttonId}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => toggle(index)}
              className="flex min-h-[54px] w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-alt/40 sm:min-h-[56px] sm:px-5 sm:py-4"
            >
              <span className="text-[13.5px] leading-snug tracking-[0.005em] text-foreground sm:text-[14.5px]">
                {q}
              </span>
              <span
                className={`shrink-0 font-mono text-lg text-[#0369A1] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  open ? "rotate-45" : ""
                }`}
                aria-hidden="true"
              >
                +
              </span>
            </button>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="border-t-[1px] border-stroke px-4 py-3.5 text-[13px] leading-[1.75] tracking-[0.012em] text-secondary sm:px-5 sm:py-4">
                  {a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
