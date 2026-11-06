import React from "react";
import type { LucideIcon } from "lucide-react";
import { EASE_GLASS, EASE_IN, prog } from "../lib/anim";

/**
 * Label fitur kecil di pojok kiri atas: satu-satunya overlay tetap, supaya penonton tahu
 * sedang melihat fitur apa (juga saat menonton tanpa suara), tanpa memenuhi layar.
 */
export const FeatureTag: React.FC<{ t: number; at: number; dur?: number; icon: LucideIcon; label: string; badge?: string }> = ({ t, at, dur = 2.6, icon: Icon, label, badge }) => {
  const inP = prog(t, at, 0.55, EASE_GLASS);
  const out = prog(t, at + dur, 0.35, EASE_IN);
  if (inP <= 0 || out >= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        top: 48,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "9px 16px 9px 10px",
        background: "rgba(255,255,255,0.96)",
        boxShadow: "0 -2px 0 0 #163A55, 0 2px 0 0 #163A55, -2px 0 0 0 #163A55, 2px 0 0 0 #163A55, 6px 6px 0 0 #0369A1",
        opacity: 1 - out,
        transform: `translateX(${(1 - inP) * -40}px)`,
        clipPath: `inset(-12px ${(1 - inP) * 100}% -12px -12px)`,
      }}
    >
      <span className="px-icon" style={{ width: 36, height: 36 }}>
        <Icon style={{ width: 18, height: 18 }} />
      </span>
      <span className="font-display" style={{ fontSize: 23, fontWeight: 700, color: "#072033", letterSpacing: "-0.02em" }}>
        {label}
      </span>
      {badge && (
        <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fff", background: "#0369A1", padding: "4px 8px" }}>
          {badge}
        </span>
      )}
    </div>
  );
};
