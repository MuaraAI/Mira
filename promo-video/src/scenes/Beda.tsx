import React from "react";
import { spring } from "remotion";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { FPS, T } from "../timeline";
import { ElearningDashboard, ElearningLogin } from "../components/elearning";
import { LoginDesktop, type LoginCheckState } from "../components/login";
import { DashboardShell, RingkasanDesktop } from "../components/dashboard";
import { TabletRingkasan } from "../components/mobile";
import { MobileRingkasan } from "../components/phone";
import { LineRise, MistBackground, PixelCursor } from "../components/motion";
import { DEMO } from "../data";
import { EASE_GLASS, EASE_HAND, EASE_IN, clamp, lerp, prog, pxShadow } from "../lib/anim";

/**
 * Portal kampus vs Mira, head to head: dua halaman ditumpuk di bingkai browser yang SAMA
 * (posisi & ukuran identik), dipisah slider pembeda. Babak 1: form login vs form login,
 * slider digeser kursor. Babak 2: dashboard vs dashboard, slider berjalan sendiri bolak-balik
 * mengikuti narasi. Babak 3: Mira di laptop, tablet, HP dengan bingkai yang seragam.
 */

function springAt(t: number, at: number, damping: number, stiffness: number) {
  if (t < at) return 0;
  return spring({ frame: Math.round((t - at) * FPS), fps: FPS, config: { damping, stiffness, mass: 1 } });
}

const PAGE = { w: 1440, h: 900, bar: 46 };
const S = 0.72;
const FW = PAGE.w * S;
const FH = (PAGE.h + PAGE.bar) * S;
const FX = 960 - FW / 2;
const FY = 150;

const FORM = { nim: DEMO.nim, siakad: 9, mybest: 9, agree: true, focus: null, submit: "idle" as const };
const CHECK: LoginCheckState = {
  appearAt: -10,
  elapsed: 0,
  steps: { form: "pending", siakad: "pending", mybest: "pending", session: "pending", redirect: "pending" },
};

/** Posisi pembatas 0..1 (bagian kiri = portal kampus, kanan = Mira). */
function divider(t: number) {
  const drag = (at: number) => springAt(t, at, 26, 120); // ditarik tangan: mantap, tanpa memantul
  const walk = (at: number) => springAt(t, at, 15, 95); // berjalan sendiri: sedikit mengayun
  return (
    1 +
    (0.5 - 1) * springAt(t, T.dividerIn, 18, 90) +
    (0.78 - 0.5) * drag(T.drag1) +
    (0.22 - 0.78) * drag(T.drag2) +
    (0.5 - 0.22) * drag(T.drag3) +
    (0.76 - 0.5) * walk(T.walk1) +
    (0.24 - 0.76) * walk(T.walk2) +
    (0.5 - 0.24) * walk(T.walk3)
  );
}

const PortalBar: React.FC<{ url: string }> = ({ url }) => (
  <div style={{ height: PAGE.bar, background: "#202124", display: "flex", alignItems: "center", gap: 10, padding: "0 18px" }}>
    <span style={{ width: 13, height: 13, borderRadius: 7, background: "#ff5f57" }} />
    <span style={{ width: 13, height: 13, borderRadius: 7, background: "#febc2e" }} />
    <span style={{ width: 13, height: 13, borderRadius: 7, background: "#28c840" }} />
    <span style={{ marginLeft: 22, width: 620, height: 30, borderRadius: 15, background: "#35363a", color: "#e8eaed", display: "flex", alignItems: "center", padding: "0 16px", fontSize: 15, fontFamily: "Inter, system-ui, sans-serif" }}>{url}</span>
  </div>
);

const MiraBar: React.FC<{ url: string }> = ({ url }) => (
  <div style={{ height: PAGE.bar, background: "#EAF3F9", borderBottom: "2px solid #CFE2EE", display: "flex", alignItems: "center", gap: 8, padding: "0 18px" }}>
    <span style={{ width: 12, height: 12, background: "#BE123C" }} />
    <span style={{ width: 12, height: 12, background: "#FCD34D" }} />
    <span style={{ width: 12, height: 12, background: "#0F766E" }} />
    <span className="font-mono" style={{ marginLeft: 26, height: 30, width: 620, background: "#fff", boxShadow: pxShadow("#CFE2EE"), display: "flex", alignItems: "center", gap: 8, padding: "0 12px", fontSize: 14, color: "#072033" }}>
      <Lock style={{ width: 14, height: 14, color: "#0F766E" }} />
      {url}
    </span>
  </div>
);

/**
 * Halaman portal (didesain 1920x1036) di-"cover" ke tinggi 900. `shift` menggeser halaman
 * (px bingkai) dan `extra` melebarkan kanvasnya supaya latar gradien tetap penuh.
 */
const PortalPage: React.FC<{ children: React.ReactNode; shift?: number; extra?: number }> = ({ children, shift = 0, extra = 0 }) => {
  const k = PAGE.h / 1036;
  return (
    <div style={{ position: "absolute", left: (PAGE.w - 1920 * k) / 2 + shift, top: 0, width: 1920 + extra, height: 1036, transform: `scale(${k})`, transformOrigin: "0 0" }}>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </div>
  );
};

/** Isi dua babak dengan transisi geser vertikal di dalam bingkai. */
const Swap: React.FC<{ t: number; a: React.ReactNode; b: React.ReactNode }> = ({ t, a, b }) => {
  const p = prog(t, T.swap, 0.6, EASE_GLASS);
  return (
    <div style={{ position: "absolute", left: 0, top: PAGE.bar, width: PAGE.w, height: PAGE.h, overflow: "hidden" }}>
      {p < 1 && <div style={{ position: "absolute", inset: 0, transform: `translateY(${-p * 100}%)` }}>{a}</div>}
      {p > 0 && <div style={{ position: "absolute", inset: 0, transform: `translateY(${(1 - p) * 100}%)` }}>{b}</div>}
    </div>
  );
};

const Caption: React.FC<{ t: number; side: "l" | "r"; emph: number; title: string; sub: string }> = ({ side, emph, title, sub }) => (
  <div style={{ position: "absolute", top: FY + FH + 34, ...(side === "l" ? { left: FX } : { right: 1920 - (FX + FW) }), textAlign: side === "l" ? "left" : "right", opacity: lerp(0.5, 1, emph), transform: `translateY(${(1 - emph) * 4}px)` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: side === "l" ? "flex-start" : "flex-end" }}>
      <span style={{ width: 12, height: 12, background: side === "l" ? "#BE123C" : "#0F766E" }} />
      <span className="font-display" style={{ fontSize: 30, fontWeight: 700, color: "#072033", letterSpacing: "-0.02em" }}>
        {title}
      </span>
    </div>
    <div className="font-mono" style={{ marginTop: 4, fontSize: 18, color: "#3B5A70" }}>
      {sub}
    </div>
  </div>
);

/* -------------------------------------------------- babak 3: perangkat seragam */
export const Device: React.FC<{ kind: "laptop" | "tablet" | "phone"; t: number; style?: React.CSSProperties }> = ({ kind, t, style }) => {
  if (kind === "laptop") {
    const s = 0.42;
    const w = PAGE.w * s;
    const h = (PAGE.h + PAGE.bar) * s;
    return (
      <div style={{ ...style, width: w + 16, height: h + 16 + 24 }}>
        <div style={{ position: "absolute", left: 10, top: 10, width: w + 16, height: h + 16, background: "#0369A1" }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: w + 16, height: h + 16, background: "#072033", padding: 8 }}>
          <div style={{ width: w, height: h, overflow: "hidden", position: "relative", background: "#F7FAFC" }}>
            <div style={{ width: PAGE.w, height: PAGE.h + PAGE.bar, transform: `scale(${s})`, transformOrigin: "0 0" }}>
              <MiraBar url="mira.muaraai.com/dashboard" />
              <div style={{ position: "relative", width: PAGE.w, height: PAGE.h, overflow: "hidden" }}>
                <DashboardShell active="/dashboard" title="Ringkasan">
                  <RingkasanDesktop t={t} load={-10} ipk={DEMO.ipk} />
                </DashboardShell>
              </div>
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", left: -26, top: h + 14, width: w + 68, height: 22, background: "#163A55", boxShadow: "inset 0 3px 0 0 #2A5A7C, 8px 8px 0 0 #0369A1" }}>
          <div style={{ position: "absolute", left: "50%", top: 0, width: 110, height: 6, transform: "translateX(-50%)", background: "#0B2D46" }} />
        </div>
      </div>
    );
  }
  const n = kind === "tablet" ? { w: 820, h: 1180, s: 0.31, b: 12 } : { w: 390, h: 844, s: 0.45, b: 10 };
  return (
    <div style={{ ...style, width: n.w * n.s + n.b * 2, height: n.h * n.s + n.b * 2 }}>
      <div style={{ position: "absolute", left: 10, top: 10, right: -10, bottom: -10, background: "#0369A1" }} />
      <div style={{ position: "absolute", inset: 0, background: "#072033", padding: n.b }}>
        <div style={{ width: n.w * n.s, height: n.h * n.s, overflow: "hidden", position: "relative", background: "#F7FAFC" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: n.w, height: n.h, transform: `scale(${n.s})`, transformOrigin: "0 0" }}>
            {kind === "tablet" ? <TabletRingkasan t={t} /> : <MobileRingkasan t={t} scroll={0} status="waiting" press={false} toast={0} />}
          </div>
        </div>
      </div>
    </div>
  );
};

const BADGES = ["Login sekali · 7 hari", "Kode keamanan otomatis", "Notifikasi absen", "Rapi di semua layar"];

export const Beda: React.FC<{ t: number }> = ({ t }) => {
  const p = clamp(divider(t), 0, 1);
  const frameIn = prog(t, T.bedaIn + 0.15, 0.6, EASE_GLASS);
  const frameOut = prog(t, T.summary, 0.5, EASE_IN);
  const hx = FX + p * FW;
  const hy = FY + FH / 2 + 10;
  const dragging = t >= T.drag1 - 0.08 && t < T.drag3 + 0.55;
  const beat2 = t >= T.swap + 0.3;

  // Kursor: datang ke pegangan, lalu menempel selama digeser.
  const approach = EASE_HAND(clamp((t - (T.drag1 - 0.65)) / 0.55));
  const curFollow = { x: hx + 6, y: hy + 10 };
  const cur = t < T.drag1 - 0.1 ? { x: lerp(hx + 230, curFollow.x, approach), y: lerp(hy + 200, curFollow.y, approach) } : curFollow;

  const emL = clamp((p - 0.5) / 0.22);
  const emR = clamp((0.5 - p) / 0.22);
  const base = 0.62;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <MistBackground drift={t * 6} />

      {frameOut < 1 && (
        <div style={{ position: "absolute", inset: 0, opacity: frameIn * (1 - frameOut), transform: `translateY(${(1 - frameIn) * 40 - frameOut * 30}px) scale(${lerp(1, 0.96, frameOut)})`, transformOrigin: "960px 560px" }}>
          {/* Label sisi */}
          <div className="font-mono" style={{ position: "absolute", left: FX, top: FY - 64, padding: "9px 16px", background: "#3B0A6B", color: "#fff", fontSize: 19, fontWeight: 700, letterSpacing: "0.2em", opacity: lerp(0.55, 1, Math.max(emL, base)) }}>
            PORTAL KAMPUS
          </div>
          <div className="font-mono" style={{ position: "absolute", right: 1920 - (FX + FW), top: FY - 64, padding: "9px 16px", background: "#072033", color: "#fff", fontSize: 19, fontWeight: 700, letterSpacing: "0.2em", boxShadow: "4px 4px 0 0 #0369A1", opacity: lerp(0.55, 1, Math.max(emR, base)) }}>
            MIRA
          </div>

          {/* Bingkai tunggal, dua halaman ditumpuk */}
          <div style={{ position: "absolute", left: FX, top: FY, width: FW, height: FH, boxShadow: "0 0 0 2px #163A55, 12px 12px 0 2px #9CC6E0" }} />
          <div style={{ position: "absolute", left: FX, top: FY, width: PAGE.w, height: PAGE.h + PAGE.bar, transform: `scale(${S})`, transformOrigin: "0 0", overflow: "hidden", background: "#fff" }}>
            <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>
              <PortalBar url={beat2 ? "elearning.bsi.ac.id/user/dashboard" : "elearning.bsi.ac.id/login"} />
              <Swap
                t={t}
                a={
                  <>
                    <PortalPage shift={-776} extra={1100}>
                      <ElearningLogin t={t} s={{ nim: DEMO.nim, pw: 8, captchaCode: "K7P", captchaTyped: "K7P", focus: "captcha" }} />
                    </PortalPage>
                    {/* hanya terlihat saat slider digeser ke kanan: sesi portal yang terus menghitung mundur */}
                    <div style={{ position: "absolute", left: 732, top: 380, width: 380, padding: "22px 24px", borderRadius: 18, background: "rgba(17,10,40,.82)", color: "#fff", fontFamily: "Inter, system-ui, sans-serif", boxShadow: "0 20px 50px rgba(0,0,0,.35)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, fontWeight: 700 }}>
                        <span style={{ width: 14, height: 14, borderRadius: 7, background: "#F87171" }} />
                        Sesi akan berakhir
                      </div>
                      <div style={{ marginTop: 8, fontSize: 64, fontWeight: 800, letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums" }}>
                        {(() => {
                          const left = Math.max(0, 899 - Math.floor((t - T.bedaIn) * 1));
                          return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
                        })()}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 18, color: "rgba(255,255,255,.75)", lineHeight: 1.4 }}>Setelah itu login + kode keamanan lagi.</div>
                    </div>
                  </>
                }
                b={
                  <PortalPage>
                    <ElearningDashboard />
                  </PortalPage>
                }
              />
            </div>
            <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${p * 100}%)` }}>
              <MiraBar url={beat2 ? "mira.muaraai.com/dashboard" : "mira.muaraai.com/masuk"} />
              <Swap
                t={t}
                a={
                  <>
                    <LoginDesktop t={t} load={-10} phase="form" form={FORM} check={CHECK} />
                    {/* hanya terlihat saat slider digeser ke kiri */}
                    <div style={{ position: "absolute", left: 360, top: 640, display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: "#0F766E", color: "#fff", boxShadow: "6px 6px 0 0 #FCD34D" }}>
                      <span className="font-mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.08em" }}>
                        SESI AKTIF 7 HARI
                      </span>
                    </div>
                  </>
                }
                b={
                  <DashboardShell active="/dashboard" title="Ringkasan">
                    <RingkasanDesktop t={t} load={-10} ipk={DEMO.ipk} />
                  </DashboardShell>
                }
              />
            </div>
            {/* garis pembatas */}
            <div style={{ position: "absolute", left: p * PAGE.w - 3, top: 0, width: 6, height: "100%", background: "#FFFFFF", boxShadow: "0 0 0 2px #072033" }} />
          </div>

          {/* Pegangan slider */}
          <div
            style={{
              position: "absolute",
              left: hx - 36,
              top: hy - 36,
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: dragging ? "#072033" : "#FFFFFF",
              boxShadow: `0 0 0 3px #072033, ${dragging ? 3 : 6}px ${dragging ? 3 : 6}px 0 3px #0369A1`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${dragging ? 1.08 : 1})`,
            }}
          >
            <ChevronLeft style={{ width: 26, height: 26, color: dragging ? "#fff" : "#072033", marginRight: -4 }} />
            <ChevronRight style={{ width: 26, height: 26, color: dragging ? "#fff" : "#072033", marginLeft: -4 }} />
          </div>

          {/* Keterangan di bawah, ikut menyala sesuai sisi yang sedang dibuka */}
          {!beat2 ? (
            <>
              <Caption t={t} side="l" emph={Math.max(emL, base * (1 - emR))} title="Login + kode keamanan" sub="sesi ± 15 menit, lalu ulang lagi" />
              <Caption t={t} side="r" emph={Math.max(emR, base * (1 - emL))} title="Login sekali" sub="sesi aktif 7 hari, kode keamanan otomatis" />
            </>
          ) : (
            <>
              <Caption t={t} side="l" emph={Math.max(emL, base * (1 - emR))} title="Jadwal di portal lain" sub="buka Student V2, login lagi" />
              <Caption t={t} side="r" emph={Math.max(emR, base * (1 - emL))} title="Jadwal langsung terlihat" sub="kelas berikutnya di halaman depan" />
            </>
          )}

          <PixelCursor t={t} init={cur} keys={[]} clicks={[T.drag1 - 0.05]} show={[T.drag1 - 0.7, T.drag3 + 0.55]} />
        </div>
      )}

      {/* Babak 3: satu Mira, tiga perangkat */}
      {t >= T.summary && (
        <>
          <div className="font-display" style={{ position: "absolute", left: 0, right: 0, top: 150, textAlign: "center", fontSize: 66, fontWeight: 700, letterSpacing: "-0.04em", color: "#072033" }}>
            <LineRise t={t} at={T.summary + 0.3}>
              Rapi di layar apa pun.
            </LineRise>
          </div>
          <Device kind="laptop" t={t} style={{ position: "absolute", left: 352, top: 800 - 437, ...rise(t, T.summary + 0.25) }} />
          <Device kind="tablet" t={t} style={{ position: "absolute", left: 352 + 621 + 60, top: 800 - 390, ...rise(t, T.summary + 0.38) }} />
          <Device kind="phone" t={t} style={{ position: "absolute", left: 352 + 621 + 60 + 278 + 60, top: 800 - 400, ...rise(t, T.summary + 0.5) }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 880, display: "flex", justifyContent: "center", gap: 14 }}>
            {BADGES.map((b, i) => {
              const k = springAt(t, T.summary + 0.95 + i * 0.2, 14, 180);
              return (
                <span key={b} className="font-mono" style={{ padding: "10px 18px", background: "#fff", boxShadow: pxShadow("#163A55", "#0F766E", 4), fontSize: 20, fontWeight: 700, color: "#072033", opacity: clamp(k * 1.5), transform: `scale(${lerp(0.7, 1, k)})` }}>
                  <span style={{ display: "inline-block", width: 9, height: 9, background: "#0F766E", marginRight: 10, transform: "translateY(-1px)" }} />
                  {b}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

function rise(t: number, at: number): React.CSSProperties {
  const p = prog(t, at, 0.7, EASE_GLASS);
  return { opacity: p, transform: `translateY(${(1 - p) * 50}px)` };
}

