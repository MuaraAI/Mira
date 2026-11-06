import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BAB, DURATION, SCENES, STORY_PARTS, T } from "../timeline";
import { InkBackground } from "../components/motion";
import { Device } from "../scenes/Beda";
import { SubtitleText, Subtitles, lineAt } from "../components/subtitles";
import { EASE_GLASS, clamp, prog } from "../lib/anim";

/**
 * Format posting dari video dasar 16:9 (out/mira-tutorial-bisu.mp4 -> public/render/base.mp4):
 *  - YouTube 16:9: video + subtitle Jersey 25 + audio
 *  - IG Reels / Story 9:16 dan IG Feed 4:5: video di bingkai pixel Mira, judul, chip bab,
 *    subtitle besar di bawah video, progres per bab, dan URL. Area aman UI Instagram dijaga.
 * Audio: public/render/mix-lengkap.wav (narasi + SFX + musik).
 */

const BASE = "render/base.mp4";
const MIX = "render/mix-lengkap.wav";
const CHAPTER_NO = (i: number) => String(i + 1).padStart(2, "0");

/** Waktu global (detik dari awal video penuh) untuk komposisi turunan. */
function useGlobalTime(from: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return from + frame / fps;
}

function sceneIndexAt(t: number) {
  const i = SCENES.findIndex((s) => t >= s.start && t < s.end);
  return i < 0 ? SCENES.length - 1 : i;
}

/** Audio mix lengkap dengan fade pendek di tepi potongan supaya tidak terdengar terpotong. */
const MixAudio: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const { fps } = useVideoConfig();
  const len = to - from;
  return (
    <Audio
      src={staticFile(MIX)}
      trimBefore={Math.round(from * fps)}
      volume={(f) => {
        const s = f / fps;
        const fin = from > 0 ? clamp(s / 0.08) : 1;
        const fout = to < DURATION ? clamp((len - s) / 0.45) : 1;
        return Math.min(fin, fout);
      }}
    />
  );
};

/* ------------------------------------------------------------------ YouTube 16:9 */
export const MiraYouTube: React.FC = () => {
  const t = useGlobalTime(0);
  return (
    <AbsoluteFill style={{ background: "#050E16" }}>
      <OffthreadVideo src={staticFile(BASE)} muted />
      <Subtitles t={t} size={54} bottom={40} />
      <MixAudio from={0} to={DURATION} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ bagian bersama format vertikal */
const LogoMark: React.FC<{ size: number }> = ({ size }) => (
  <span style={{ position: "relative", width: size, height: size, flexShrink: 0, borderRadius: "50%", background: "#fff", boxShadow: `0 0 0 ${Math.round(size * 0.04)}px #072033, ${Math.round(size * 0.07)}px ${Math.round(size * 0.07)}px 0 ${Math.round(size * 0.04)}px #0369A1` }}>
    <Img src={staticFile("logo/logo.png")} style={{ position: "absolute", inset: size * 0.05, width: size * 0.9, height: size * 0.9, borderRadius: "50%" }} />
  </span>
);

const ChapterChip: React.FC<{ t: number; size: number }> = ({ t, size }) => {
  const i = sceneIndexAt(t);
  const s = SCENES[i];
  const p = prog(t, s.start, 0.45, EASE_GLASS);
  return (
    <div style={{ display: "inline-flex", alignItems: "stretch", boxShadow: `0 0 0 2px #163A55, 5px 5px 0 2px #0369A1`, overflow: "hidden" }}>
      <span className="font-mono tabular" style={{ padding: `${size * 0.32}px ${size * 0.5}px`, background: "#FCD34D", color: "#072033", fontSize: size, fontWeight: 700 }}>
        {CHAPTER_NO(i)}
      </span>
      <span style={{ position: "relative", padding: `${size * 0.32}px ${size * 0.6}px`, background: "#0B2D46", color: "#fff", fontSize: size, fontWeight: 700, whiteSpace: "nowrap", fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
        <span style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>{BAB[s.id]}</span>
      </span>
    </div>
  );
};

const Progress: React.FC<{ t: number; width: number }> = ({ t, width }) => {
  const gap = 6;
  const usable = width - gap * (SCENES.length - 1);
  return (
    <div style={{ display: "flex", gap, width }}>
      {SCENES.map((s) => {
        const w = (usable * (s.end - s.start)) / DURATION;
        const fill = clamp((t - s.start) / (s.end - s.start));
        return (
          <span key={s.id} style={{ position: "relative", width: w, height: 12, background: "#163A55" }}>
            <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: fill >= 1 ? "#5FA3CC" : "#FCD34D" }} />
          </span>
        );
      })}
    </div>
  );
};

const UrlChip: React.FC<{ size: number }> = ({ size }) => (
  <span className="font-mono" style={{ display: "inline-block", padding: `${size * 0.35}px ${size * 0.8}px`, background: "#FCD34D", color: "#072033", fontSize: size, fontWeight: 700, boxShadow: `0 0 0 2px #072033, 6px 6px 0 2px #0369A1` }}>
    mira.muaraai.com
  </span>
);

/** Video dasar dalam bingkai pixel Mira. */
const VideoFrame: React.FC<{ from: number; x: number; y: number; w: number }> = ({ from, x, y, w }) => {
  const { fps } = useVideoConfig();
  const h = (w * 9) / 16;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, boxShadow: "0 0 0 3px #163A55, 10px 10px 0 3px #0369A1", background: "#050E16" }}>
      <OffthreadVideo src={staticFile(BASE)} muted trimBefore={Math.round(from * fps)} style={{ width: w, height: h }} />
    </div>
  );
};

const BigSubtitle: React.FC<{ t: number; top: number; size: number; width: number }> = ({ t, top, size, width }) => {
  const line = lineAt(t);
  if (!line) return null;
  const p = Math.min(clamp((t - (line.start - 0.04)) / 0.12), clamp((line.end - t) / 0.12));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center", opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
      <div style={{ maxWidth: width, textAlign: "center", textShadow: "0 3px 0 #0369A1" }}>
        <SubtitleText t={t} line={line} size={size} />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ IG Reels / Story 9:16 */
const Vertical: React.FC<{ from: number; to: number; part?: { n: number; of: number } }> = ({ from, to, part }) => {
  const t = useGlobalTime(from);
  const local = t - from;
  const len = to - from;
  const next = part && part.n < part.of ? clamp((local - (len - 1.8)) / 0.35) : 0;
  return (
    <AbsoluteFill style={{ background: "#072033", overflow: "hidden" }}>
      <InkBackground stripesShift={t * 8} />
      {/* Kepala (di bawah area profil Instagram) */}
      <div style={{ position: "absolute", left: 56, right: 56, top: 250, display: "flex", alignItems: "center", gap: 22 }}>
        <LogoMark size={84} />
        <div style={{ flex: 1 }}>
          <div className="font-mono" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.26em", color: "#9CC6E0" }}>
            TUTORIAL · 2 MENIT
          </div>
          <div className="font-display" style={{ marginTop: 4, fontSize: 64, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em", color: "#fff" }}>
            Cara pakai <span style={{ color: "#FCD34D" }}>Mira</span>
          </div>
        </div>
        {part && (
          <span className="font-mono tabular" style={{ padding: "10px 16px", background: "#0B2D46", boxShadow: "0 0 0 2px #163A55", color: "#fff", fontSize: 28, fontWeight: 700 }}>
            {part.n}/{part.of}
          </span>
        )}
      </div>
      <div style={{ position: "absolute", left: 56, top: 430 }}>
        <ChapterChip t={t} size={30} />
      </div>
      <VideoFrame from={from} x={28} y={600} w={1024} />
      <BigSubtitle t={t} top={1252} size={70} width={980} />
      <div style={{ position: "absolute", left: 60, top: 1500 }}>
        <Progress t={t} width={960} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1548, display: "flex", justifyContent: "center", gap: 18, alignItems: "center" }}>
        {next > 0 ? (
          <span className="font-mono" style={{ padding: "14px 26px", background: "#fff", color: "#072033", fontSize: 30, fontWeight: 700, boxShadow: "0 0 0 2px #072033, 6px 6px 0 2px #0369A1", opacity: next, transform: `translateX(${(1 - next) * 30}px)` }}>
            Lanjut ke bagian {part!.n + 1} →
          </span>
        ) : (
          <UrlChip size={30} />
        )}
      </div>
      <MixAudio from={from} to={to} />
    </AbsoluteFill>
  );
};

export const MiraReels: React.FC = () => <Vertical from={0} to={DURATION} />;
export const MiraStory: React.FC<{ part: number }> = ({ part }) => <Vertical from={STORY_PARTS[part].from} to={STORY_PARTS[part].to} part={{ n: part + 1, of: STORY_PARTS.length }} />;

/* ------------------------------------------------------------------ IG Feed 4:5 */
export const MiraFeed: React.FC = () => {
  const t = useGlobalTime(0);
  return (
    <AbsoluteFill style={{ background: "#072033", overflow: "hidden" }}>
      <InkBackground stripesShift={t * 8} />
      <div style={{ position: "absolute", left: 40, right: 40, top: 56, display: "flex", alignItems: "center", gap: 18 }}>
        <LogoMark size={64} />
        <div className="font-display" style={{ flex: 1, fontSize: 50, fontWeight: 700, letterSpacing: "-0.04em", color: "#fff", whiteSpace: "nowrap" }}>
          Cara pakai <span style={{ color: "#FCD34D" }}>Mira</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 40, top: 148 }}>
        <ChapterChip t={t} size={24} />
      </div>
      <VideoFrame from={0} x={28} y={238} w={1024} />
      <BigSubtitle t={t} top={872} size={60} width={980} />
      <div style={{ position: "absolute", left: 60, top: 1172 }}>
        <Progress t={t} width={960} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1212, display: "flex", justifyContent: "center" }}>
        <UrlChip size={28} />
      </div>
      <MixAudio from={0} to={DURATION} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ cover / thumbnail */
export const MiraCover: React.FC<{ kind: "youtube" | "feed" | "story" }> = ({ kind }) => {
  const wide = kind === "youtube";
  const tall = kind === "story";
  const t = T.summary + 3; // perangkat sudah tampil penuh
  const head = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: wide ? 18 : 22 }}>
        <LogoMark size={wide ? 70 : 86} />
        <span className="font-display" style={{ fontSize: wide ? 54 : 64, fontWeight: 700, letterSpacing: "-0.04em", color: "#fff" }}>
          Mira
        </span>
      </div>
      <div className="font-display" style={{ marginTop: wide ? 26 : 36, fontSize: wide ? 104 : tall ? 132 : 112, fontWeight: 700, lineHeight: 0.98, letterSpacing: "-0.05em", color: "#fff" }}>
        Kuliah
        <br />
        <span style={{ color: "#FCD34D" }}>tanpa ribet.</span>
      </div>
      <div className="font-mono" style={{ marginTop: wide ? 22 : 30, fontSize: wide ? 26 : 32, fontWeight: 700, color: "#9CC6E0", lineHeight: 1.4 }}>
        Jadwal · tugas · presensi · chat kelas
        <br />
        login sekali, aktif 7 hari
      </div>
    </>
  );
  const scaleDevice = wide ? 0.62 : tall ? 1.15 : 0.95;
  return (
    <AbsoluteFill style={{ background: "#072033", overflow: "hidden" }}>
      <InkBackground />
      {wide ? (
        <>
          <div style={{ position: "absolute", left: 64, top: 70, width: 640 }}>{head}</div>
          <div style={{ position: "absolute", left: 740, top: 150, transform: `scale(${scaleDevice})`, transformOrigin: "0 0" }}>
            <Device kind="laptop" t={t} style={{ position: "absolute", left: 0, top: 120 }} />
            <Device kind="phone" t={t} style={{ position: "absolute", left: 600, top: 40 }} />
          </div>
          <div style={{ position: "absolute", left: 64, bottom: 56 }}>
            <UrlChip size={26} />
          </div>
        </>
      ) : (
        <>
          <div style={{ position: "absolute", left: 64, right: 64, top: tall ? 280 : 80 }}>{head}</div>
          <div style={{ position: "absolute", left: "50%", top: tall ? 980 : 760, transform: `translateX(-50%) scale(${scaleDevice})`, transformOrigin: "50% 0" }}>
            <div style={{ position: "relative", width: 640, height: 470 }}>
              <Device kind="laptop" t={t} style={{ position: "absolute", left: -60, top: 30 }} />
              <Device kind="phone" t={t} style={{ position: "absolute", left: 470, top: -20 }} />
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: tall ? 300 : 70, display: "flex", justifyContent: "center" }}>
            <UrlChip size={tall ? 36 : 30} />
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

