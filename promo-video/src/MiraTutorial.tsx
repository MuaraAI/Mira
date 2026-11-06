import React from "react";
import { AbsoluteFill } from "remotion";
import { DURATION, SCENES, SWEEPS, T, type SceneId } from "./timeline";
import { useTime } from "./lib/anim";
import { TileSweep } from "./components/motion";
import { Hook } from "./scenes/Hook";
import { Reveal } from "./scenes/Reveal";
import { Desktop } from "./scenes/Desktop";
import { Mobile } from "./scenes/Mobile";
import { Aman } from "./scenes/Aman";
import { Beda } from "./scenes/Beda";
import { Outro } from "./scenes/Outro";

/**
 * Adegan yang berurutan di layar yang sama (desktop: masuk -> komunitas, HP: morph -> presensi)
 * memakai satu komponen supaya kamera & kursor mengalir tanpa potongan.
 */
const COMPONENT: Record<SceneId, { key: string; C: React.FC<{ t: number }> }> = {
  hook: { key: "hook", C: Hook },
  reveal: { key: "reveal", C: Reveal },
  masuk: { key: "desktop", C: Desktop },
  jadwal: { key: "desktop", C: Desktop },
  tugas: { key: "desktop", C: Desktop },
  komunitas: { key: "desktop", C: Desktop },
  layar: { key: "mobile", C: Mobile },
  hp: { key: "mobile", C: Mobile },
  aman: { key: "aman", C: Aman },
  beda: { key: "beda", C: Beda },
  outro: { key: "outro", C: Outro },
};

const cosFade = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));

export const MiraTutorial: React.FC = () => {
  const t = useTime();
  const scene = SCENES.find((s) => t >= s.start && t < s.end) ?? SCENES[SCENES.length - 1];
  const { key, C } = COMPONENT[scene.id];
  return (
    <AbsoluteFill style={{ background: "#F7FAFC", overflow: "hidden" }}>
      <C key={key} t={t} />
      {SWEEPS.map((sw, i) => (
        <TileSweep key={i} t={t} sweep={sw} />
      ))}
      {/* Fade buka & tutup, sama persis dengan fade audio (scripts/audio.mjs) */}
      {(t < 0.6 || t > T.fadeOut) && <AbsoluteFill style={{ background: "#050E16", opacity: Math.max(1 - cosFade(t / 0.6), cosFade((t - T.fadeOut) / (DURATION - T.fadeOut))) }} />}
    </AbsoluteFill>
  );
};
