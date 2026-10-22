"use client";

/** Dua tab pixel di atas isi panel (dipakai pratinjau berkas dan pratinjau link). */
export function SheetTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="sticky top-0 z-10 grid gap-1 border-b-2 border-px-soft bg-white p-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={`min-h-11 px-3 font-mono text-xs font-bold transition-colors ${
            value === t.key ? "bg-[#0369A1] text-white shadow-[2px_2px_0_0_#072033]" : "bg-px-tint text-secondary hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
