import React, { useRef } from "react";
import { spring } from "remotion";
import { Laptop, Lock, Smartphone, Tablet } from "lucide-react";
import { FPS, T } from "../timeline";
import { PUSH } from "../data";
import { Camera, MistBackground, Sticker, TapMark, camAt, riseStyle } from "../components/motion";
import { StepIcon, mid, useAnchors } from "../components/ui";
import { DashboardShell, RingkasanDesktop } from "../components/dashboard";
import { LockScreen, MobileRingkasan } from "../components/phone";
import { MobileNotifikasi, MobilePresensi, PermissionPrompt, TabletRingkasan, type PresensiPhase } from "../components/mobile";
import { FeatureTag } from "../components/overlay";
import { EASE_CAM, EASE_GLASS, EASE_IN, EASE_PX, clamp, inOut, lerp, prog, pxShadow } from "../lib/anim";

/**
 * Laptop -> tablet -> HP dalam satu gerakan pegas (gaya transisi Apple). Ketiganya satu
 * keluarga perangkat: bezel tinta yang sama, sudut pixel yang sama, bayangan keras yang sama,
 * dan tata letak Mira yang sama (sidebar -> menu bawah). Label perangkat + lebar layar selalu
 * di atas. Lalu penjelasan kontras teks (lup + panah), dan alur di HP: lonceng -> aktifkan
 * notifikasi -> notifikasi absen -> presensi tanpa login ulang.
 */

function springAt(t: number, at: number, damping = 19, stiffness = 95, mass = 1) {
  if (t < at) return 0;
  return spring({ frame: Math.round((t - at) * FPS), fps: FPS, config: { damping, stiffness, mass } });
}

const smooth = (x: number, a: number, b: number) => {
  const u = clamp((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

const D = { w: 1440, h: 900, chrome: 46, bezel: 16, step: 6, scale: 0.72 };
const TB = { w: 820, h: 1180, chrome: 0, bezel: 22, step: 10, scale: 0.6 };
const PH = { w: 390, h: 844, chrome: 0, bezel: 20, step: 8, scale: 0.84 };
const BASE_H = 48;

/** lap: 0 = jendela browser (sambungan dari adegan desktop), 1 = laptop utuh. */
function geo(m: number, lap: number) {
  const D0 = { ...D, bezel: lerp(0, D.bezel, lap), step: lerp(0, D.step, lap), scale: lerp(1.04, D.scale, lap) };
  const A = m <= 1 ? D0 : TB;
  const B = m <= 1 ? TB : PH;
  const u = m <= 1 ? m : m - 1;
  const L = (k: keyof typeof D) => lerp(A[k], B[k], u);
  return { w: L("w"), h: L("h"), chrome: L("chrome"), bezel: L("bezel"), step: L("step"), scale: L("scale") };
}

function stepped(w: number, h: number, s: number) {
  if (s < 0.5) return "none";
  const pts = [
    [s * 2, 0], [w - s * 2, 0], [w - s * 2, s], [w - s, s], [w - s, s * 2], [w, s * 2],
    [w, h - s * 2], [w - s, h - s * 2], [w - s, h - s], [w - s * 2, h - s], [w - s * 2, h],
    [s * 2, h], [s * 2, h - s], [s, h - s], [s, h - s * 2], [0, h - s * 2],
    [0, s * 2], [s, s * 2], [s, s], [s * 2, s],
  ];
  return `polygon(${pts.map(([x, y]) => `${x}px ${y}px`).join(", ")})`;
}

const STEPS = [
  { label: "Aktifkan notifikasi", detail: "Ketuk lonceng di kanan atas", from: T.bellTap - 1.0, done: T.izinkanTap + 0.15 },
  { label: "Notif absen otomatis", detail: "Masuk saat dosen membuka absen", from: T.lockScreen, done: T.pushAbsen },
  { label: "Absen tanpa login ulang", detail: "Sesi tetap aktif 7 hari", from: T.pushTap, done: T.absenOk },
];

const DEVICES = [
  { Icon: Laptop, name: "Laptop" },
  { Icon: Tablet, name: "Tablet" },
  { Icon: Smartphone, name: "HP" },
];

export const Mobile: React.FC<{ t: number }> = ({ t }) => {
  const root = useRef<HTMLDivElement>(null);
  const a = useAnchors(root);

  // Jendela browser "mundur" dan ternyata ada di laptop, lalu morph 0 (laptop) -> 1 (tablet) -> 2 (HP).
  const lap = prog(t, T.layarIn + 0.1, 1.1, EASE_CAM);
  const m = Math.min(2, springAt(t, T.morphTablet, 17, 85) + springAt(t, T.morphPhone, 17, 85));
  const g = geo(Math.max(0, m), lap);
  // Menjelang alur HP, HP membesar ke ukuran aslinya (anchor ketukan dihitung di skala 1).
  const grow = prog(t, T.contrastOut + 0.05, 0.85, EASE_CAM) * smooth(m, 1.5, 2);
  const display = g.scale * lerp(1, 1 / PH.scale, grow);
  const W = g.w + g.bezel * 2;
  const H = g.h + g.chrome + g.bezel * 2;
  const baseOp = lap * (1 - smooth(m, 0.02, 0.32));
  const lift = (BASE_H / 2) * baseOp * display;

  // Lapisan konten: tiap tata letak dirender di lebar aslinya lalu diskalakan ke bingkai.
  const opDesk = 1 - smooth(m, 0.2, 0.7);
  const opTab = smooth(m, 0.2, 0.7) * (1 - smooth(m, 1.2, 1.7));
  const opPhone = smooth(m, 1.2, 1.7);

  // Alur HP
  const phonePage = t < T.notifPage ? "ringkasan" : t < T.lockScreen ? "notif" : t < T.presensiOpen ? "lock" : "presensi";
  const presPhase: PresensiPhase = t < T.kirimTap + 0.05 ? "open" : t < T.absenOk ? "submitting" : "present";
  const wake = prog(t, T.lockScreen, 0.35, EASE_PX);
  const openApp = prog(t, T.presensiOpen - 0.05, 0.45, EASE_GLASS);

  const bell = mid(a["m-bell"], 0.5, 0.5, { x: 1110, y: 175 });
  const aktifkan = mid(a["m-aktifkan"], 0.5, 0.5, { x: 960, y: 560 });
  const izinkan = mid(a["m-izinkan"], 0.5, 0.5, { x: 1080, y: 440 });
  const push = a["push-1"];
  const pushC = mid(push, 0.5, 0.5, { x: 960, y: 420 });
  const absen = mid(a["m-absen"], 0.5, 0.5, { x: 960, y: 700 });
  const kirim = mid(a["m-kirim"], 0.5, 0.5, { x: 1060, y: 900 });
  const screenLeft = 960 - W / 2 + g.bezel;
  const screenTop = 540 - H / 2 + g.bezel + g.chrome;

  const cam = camAt(t, { x: 960, y: 540, s: 1 }, [
    { t: T.contrastIn, dur: 0.85, x: 1290, y: 540, s: 1 },
    { t: 83.9, dur: 0.9, x: 1200, y: 540, s: 1 },
    { t: 84.95, dur: 0.7, x: 1145, y: 400, s: 1.3 },
    { t: T.lockScreen - 0.1, dur: 0.6, x: 1145, y: 470, s: 1.3 },
    { t: T.presensiOpen - 0.1, dur: 0.6, x: 1145, y: 560, s: 1.3 },
    { t: T.absenTap + 0.05, dur: 0.5, x: 1145, y: 690, s: 1.3 },
    { t: T.kirimTap + 0.3, dur: 0.6, x: 1145, y: 560, s: 1.3 },
    { t: 98.4, dur: 1.0, x: 1200, y: 540, s: 1 },
  ]);

  // Label perangkat + penggaris lebar (di atas perangkat, selalu terbaca)
  const labelsOn = prog(t, T.layarIn + 0.55, 0.5, EASE_GLASS) * (1 - prog(t, T.contrastIn - 0.15, 0.35, EASE_IN));
  const devOp = [1 - smooth(m, 0.35, 0.65), smooth(m, 0.35, 0.65) * (1 - smooth(m, 1.35, 1.65)), smooth(m, 1.35, 1.65)];
  const devTop = 540 - (H * display) / 2 - lift;
  const devW = W * display;

  // Penjelasan kontras: lup di judul "Kelas Hari Senin" di HP + kartu + panah
  const card = inOut(t, T.contrastIn + 0.25, 0.55, T.contrastOut, 0.4);
  const lens = inOut(t, T.contrastIn + 0.4, 0.5, T.contrastOut - 0.05, 0.35);
  const meter = prog(t, T.contrastMeter, 1.0, EASE_GLASS);
  const ratio = lerp(1, 15.5, meter);
  const head = mid(a["m-heading"], 0.42, 0.5, { x: 860, y: 640 });
  const canvasX = 960 + (head.x - 960) * display;
  const canvasY = 540 + (head.y - 540) * display - lift;
  const lensX = 960 + (canvasX - cam.x) * cam.s;
  const lensY = 540 + (canvasY - cam.y) * cam.s;
  const LR = 118;
  const CARD = { x: 1030, y: 250, w: 740 };
  const arrowDraw = prog(t, T.contrastIn + 0.7, 0.5, EASE_PX) * (1 - prog(t, T.contrastOut - 0.05, 0.3, EASE_IN));
  const ax0 = CARD.x - 14;
  const ay0 = CARD.y + 120;
  const ax1 = lensX + LR + 16;
  const ay1 = lensY;

  const phoneContent = (() => {
    if (phonePage === "ringkasan") return <MobileRingkasan t={t} scroll={0} status="waiting" press={false} toast={0} bellOn={t >= T.bellTap && t < T.notifPage + 0.3} />;
    if (phonePage === "notif")
      return (
        <>
          <MobileNotifikasi t={t} load={T.notifPage} enabled={t >= T.izinkanTap + 0.15} enableAt={T.izinkanTap + 0.15} pressAktifkan={t >= T.aktifkanTap && t < T.aktifkanTap + 0.12} />
          <PermissionPrompt p={inOut(t, T.aktifkanTap + 0.15, 0.3, T.izinkanTap + 0.05, 0.25, EASE_PX)} pressAllow={t >= T.izinkanTap && t < T.izinkanTap + 0.12} />
        </>
      );
    if (phonePage === "lock")
      return (
        <>
          <div style={{ position: "absolute", inset: 0, background: "#000" }} />
          <div style={{ position: "absolute", inset: 0, opacity: wake }}>
            <LockScreen t={t} arrivals={[T.pushClass, T.pushAbsen]} pushes={[PUSH.kelas, PUSH.absen]} unlock={0} time="07:51" />
          </div>
        </>
      );
    const originX = push ? push.x - screenLeft + push.w / 2 : 195;
    const originY = push ? push.y - screenTop + push.h / 2 : 300;
    return (
      <>
        {openApp < 1 && (
          <div style={{ position: "absolute", inset: 0 }}>
            <LockScreen t={t} arrivals={[T.pushClass, T.pushAbsen]} pushes={[PUSH.kelas, PUSH.absen]} unlock={0} time="07:51" />
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${originX}px ${originY}px`, transform: `scale(${lerp(0.2, 1, openApp)})`, opacity: Math.min(1, openApp * 2.2) }}>
          <MobilePresensi
            t={t}
            load={T.presensiOpen - 10}
            phase={presPhase}
            press={t >= T.absenTap && t < T.absenTap + 0.12}
            confirm={inOut(t, T.absenTap + 0.12, 0.32, T.kirimTap + 0.05, 0.28, EASE_PX)}
            pressKirim={t >= T.kirimTap && t < T.kirimTap + 0.12}
            success={prog(t, T.absenOk, 0.35, EASE_PX)}
          />
        </div>
      </>
    );
  })();

  const deviceTransform = `translateY(${-lift}px) scale(${display})`;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <MistBackground drift={t * 6} />
      <Camera cam={cam}>
        <div ref={root} style={{ position: "relative", width: 1920, height: 1080 }}>
          {/* Bayangan keras bingkai */}
          <div
            style={{
              position: "absolute",
              left: 960 - W / 2 + 14,
              top: 540 - H / 2 + 14,
              width: W,
              height: H,
              background: lap < 0.15 ? "#CFE2EE" : "#0369A1",
              clipPath: stepped(W, H, g.step),
              transform: deviceTransform,
              transformOrigin: `${W / 2 - 14}px ${H / 2 - 14}px`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 960 - W / 2,
              top: 540 - H / 2,
              width: W,
              height: H,
              transform: deviceTransform,
              transformOrigin: "50% 50%",
            }}
          >
            {/* Bodi laptop: engsel + dek keyboard, hanya saat mode laptop */}
            {baseOp > 0.01 && (
              <div style={{ position: "absolute", left: -W * 0.07, top: H - 2, width: W * 1.14, height: BASE_H, opacity: baseOp, transform: `translateY(${(1 - lap) * 26}px)` }}>
                <div style={{ position: "absolute", left: 14, top: 12, right: -14, bottom: -14, background: "#0369A1", clipPath: stepped(W * 1.14, BASE_H - 2, 6) }} />
                <div style={{ position: "absolute", left: W * 0.07, top: 0, width: W, height: 12, background: "#0B2D46" }} />
                <div style={{ position: "absolute", left: 0, top: 10, width: "100%", height: BASE_H - 12, background: "#163A55", clipPath: stepped(W * 1.14, BASE_H - 12, 6), boxShadow: "inset 0 3px 0 0 #2A5A7C" }}>
                  <div style={{ position: "absolute", left: "50%", top: 0, width: 230, height: 10, transform: "translateX(-50%)", background: "#0B2D46" }} />
                </div>
              </div>
            )}
            {/* Bodi perangkat: bezel tinta yang sama untuk laptop, tablet, dan HP */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#072033",
                clipPath: stepped(W, H, g.step),
                boxShadow: lap < 0.15 ? "0 -2px 0 0 #163A55, 0 2px 0 0 #163A55, -2px 0 0 0 #163A55, 2px 0 0 0 #163A55" : undefined,
              }}
            />
            {/* kamera depan (laptop & tablet) dan speaker (HP) */}
            {lap > 0.5 && m < 1.5 && <div style={{ position: "absolute", left: W / 2 - 4, top: Math.max(2, g.bezel / 2 - 4), width: 8, height: 8, background: "#163A55", opacity: smooth(lap, 0.5, 1) * (1 - smooth(m, 1.2, 1.5)) }} />}
            {m > 1.5 && <div style={{ position: "absolute", left: W / 2 - 34, top: 6, width: 68, height: 7, background: "#0B2D46", opacity: smooth(m, 1.5, 1.9) }} />}
            {/* Bar browser (laptop) yang menghilang saat berubah jadi tablet */}
            {g.chrome > 0.5 && (
              <div
                style={{
                  position: "absolute",
                  left: g.bezel,
                  top: g.bezel,
                  width: g.w,
                  height: g.chrome,
                  background: "#EAF3F9",
                  borderBottom: "2px solid #CFE2EE",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0 18px",
                  opacity: clamp(g.chrome / 46),
                }}
              >
                <span style={{ width: 12, height: 12, background: "#BE123C" }} />
                <span style={{ width: 12, height: 12, background: "#FCD34D" }} />
                <span style={{ width: 12, height: 12, background: "#0F766E" }} />
                <span className="font-mono" style={{ marginLeft: 26, height: 30, width: 620, background: "#fff", boxShadow: "0 -2px 0 0 #CFE2EE, 0 2px 0 0 #CFE2EE, -2px 0 0 0 #CFE2EE, 2px 0 0 0 #CFE2EE", display: "flex", alignItems: "center", gap: 8, padding: "0 12px", fontSize: 14, color: "#072033" }}>
                  <Lock style={{ width: 14, height: 14, color: "#0F766E" }} />
                  mira.muaraai.com/dashboard
                </span>
              </div>
            )}
            <div style={{ position: "absolute", left: g.bezel, top: g.bezel + g.chrome, width: g.w, height: g.h, overflow: "hidden", background: "#F7FAFC" }}>
              {opDesk > 0.01 && (
                <div style={{ position: "absolute", left: 0, top: 0, width: 1440, height: g.h / (g.w / 1440), transform: `scale(${g.w / 1440})`, transformOrigin: "0 0", opacity: opDesk }}>
                  <DashboardShell active="/dashboard" title="Ringkasan">
                    <RingkasanDesktop t={t} load={-10} ipk="3.75" />
                  </DashboardShell>
                </div>
              )}
              {opTab > 0.01 && (
                <div style={{ position: "absolute", left: 0, top: 0, width: 820, height: g.h / (g.w / 820), transform: `scale(${g.w / 820})`, transformOrigin: "0 0", opacity: opTab }}>
                  <TabletRingkasan t={t} />
                </div>
              )}
              {opPhone > 0.01 && (
                <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: g.h / (g.w / 390), transform: `scale(${g.w / 390})`, transformOrigin: "0 0", opacity: opPhone }}>
                  {phoneContent}
                </div>
              )}
            </div>
          </div>

          <TapMark t={t} at={T.bellTap} x={bell.x} y={bell.y} size={40} />
          <TapMark t={t} at={T.aktifkanTap} x={aktifkan.x} y={aktifkan.y} />
          <TapMark t={t} at={T.izinkanTap} x={izinkan.x} y={izinkan.y} size={40} />
          <TapMark t={t} at={T.pushTap} x={pushC.x} y={pushC.y} />
          <TapMark t={t} at={T.absenTap} x={absen.x} y={absen.y} />
          <TapMark t={t} at={T.kirimTap} x={kirim.x} y={kirim.y} />
        </div>
      </Camera>

      {/* Label perangkat + penggaris lebar layar, di atas perangkat */}
      {labelsOn > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: labelsOn, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: 960 - devW / 2, width: devW, top: devTop - 30, height: 2, background: "#5FA3CC" }} />
          <div style={{ position: "absolute", left: 960 - devW / 2, top: devTop - 40, width: 2, height: 22, background: "#5FA3CC" }} />
          <div style={{ position: "absolute", left: 960 + devW / 2 - 2, top: devTop - 40, width: 2, height: 22, background: "#5FA3CC" }} />
          <div
            style={{
              position: "absolute",
              left: 960,
              top: devTop - 98,
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              height: 52,
              background: "#fff",
              boxShadow: pxShadow("#163A55", "#0369A1", 4),
            }}
          >
            <span style={{ position: "relative", width: 210, height: 52 }}>
              {DEVICES.map(({ Icon, name }, i) => {
                const o = devOp[i];
                if (o <= 0.01) return null;
                return (
                  <span key={name} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, opacity: o, transform: `translateY(${(1 - o) * (i === 0 ? -10 : 10)}px)` }}>
                    <Icon style={{ width: 26, height: 26, color: "#0369A1" }} />
                    <span className="font-display" style={{ fontSize: 27, fontWeight: 700, color: "#072033", letterSpacing: "-0.02em" }}>
                      {name}
                    </span>
                  </span>
                );
              })}
            </span>
            <span style={{ width: 2, height: 30, background: "#CFE2EE" }} />
            <span className="font-mono tabular" style={{ width: 132, textAlign: "center", fontSize: 22, fontWeight: 700, color: "#0369A1" }}>
              {[1440, 820, 390].find((v) => Math.abs(g.w - v) < 6) ?? Math.round(g.w)} px
            </span>
          </div>
        </div>
      )}

      {/* Penjelasan kontras teks: lup di HP, panah ke kartu */}
      {lens > 0 && (
        <>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {arrowDraw > 0 && (
              <g opacity={Math.min(1, arrowDraw * 2)}>
                <line x1={ax0} y1={ay0} x2={lerp(ax0, ax1, arrowDraw)} y2={lerp(ay0, ay1, arrowDraw)} stroke="#0F766E" strokeWidth={4} />
                {arrowDraw > 0.95 && (
                  <polygon
                    points="0,0 22,-11 22,11"
                    fill="#0F766E"
                    transform={`translate(${ax1} ${ay1}) rotate(${(Math.atan2(ay1 - ay0, ax1 - ax0) * 180) / Math.PI + 180})`}
                  />
                )}
              </g>
            )}
          </svg>
          <div
            style={{
              position: "absolute",
              left: lensX - LR,
              top: lensY - LR,
              width: LR * 2,
              height: LR * 2,
              transform: `scale(${lerp(0.4, 1, lens)})`,
              opacity: Math.min(1, lens * 1.6),
            }}
          >
            <div style={{ position: "absolute", left: LR * 1.55, top: LR * 1.55, width: 26, height: 92, background: "#072033", transform: "rotate(-45deg)", transformOrigin: "50% 0" }} />
            <div
              className="portal-type"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "#F7FAFC",
                boxShadow: "0 0 0 6px #072033, 0 0 0 11px #FFFFFF, 0 0 0 14px #0F766E, 10px 10px 0 12px rgba(7,32,51,0.25)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <h2 className="font-display" style={{ fontSize: 44, fontWeight: 700, color: "#072033", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
                Kelas Hari
              </h2>
            </div>
          </div>
        </>
      )}
      {card > 0 && (
        <div
          style={{
            position: "absolute",
            left: CARD.x,
            top: CARD.y,
            width: CARD.w,
            padding: "30px 36px 34px",
            background: "#fff",
            boxShadow: pxShadow("#163A55", "#0F766E", 8),
            opacity: card,
            transform: `translateX(${(1 - card) * 40}px)`,
          }}
        >
          <div className="section-kicker" style={{ fontSize: 15, color: "#0F766E" }}>
            Kontras teks
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 10 }}>
            <span className="font-display tabular" style={{ fontSize: 96, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em", color: "#072033" }}>
              {ratio.toFixed(1).replace(".", ",")} : 1
            </span>
            <span className="font-mono" style={{ padding: "6px 12px", background: meter > 0.95 ? "#0F766E" : "#CFE2EE", color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: "0.12em" }}>
              AAA
            </span>
          </div>
          <p style={{ marginTop: 14, fontSize: 23, lineHeight: 1.45, color: "#3B5A70" }}>
            Seberapa kontras warna teks dengan latarnya. Makin tinggi, tulisan makin tajam dan mata tidak cepat lelah.
          </p>
          {/* Contoh pasangan warna yang diukur */}
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ width: 64, height: 52, display: "grid", placeItems: "center", background: "#F7FAFC", boxShadow: "0 0 0 2px #CFE2EE" }}>
              <span className="font-display" style={{ fontSize: 30, fontWeight: 700, color: "#072033" }}>
                Aa
              </span>
            </span>
            <span className="font-mono" style={{ fontSize: 17, color: "#072033", lineHeight: 1.5 }}>
              teks <b>#072033</b>
              <br />
              latar <b>#F7FAFC</b>
            </span>
          </div>
          {/* Skala 1 : 1 sampai 21 : 1 */}
          <div style={{ position: "relative", marginTop: 52, height: 16, background: "#EAF3F9", boxShadow: "0 0 0 2px #CFE2EE" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${((ratio - 1) / 20) * 100}%`, background: "linear-gradient(90deg, #5FA3CC, #0369A1 45%, #072033)" }} />
            {[
              { v: 4.5, l: "minimal 4,5" },
              { v: 7, l: "AAA mulai 7" },
            ].map(({ v, l }) => (
              <div key={v} style={{ position: "absolute", left: `${((v - 1) / 20) * 100}%`, top: -6, width: 2, height: 28, background: "#3B5A70" }}>
                <span className="font-mono" style={{ position: "absolute", top: 32, left: v < 5 ? undefined : 6, right: v < 5 ? 6 : undefined, fontSize: 14, color: "#3B5A70", whiteSpace: "nowrap" }}>
                  {l}
                </span>
              </div>
            ))}
            <div style={{ position: "absolute", left: `${((ratio - 1) / 20) * 100}%`, top: -40, transform: "translateX(-50%)", opacity: meter }}>
              <span className="font-mono" style={{ display: "block", padding: "3px 9px", background: "#072033", color: "#fff", fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" }}>
                Mira
              </span>
            </div>
          </div>
          <div style={{ height: 30 }} />
        </div>
      )}

      {/* Daftar langkah di HP */}
      {t >= 84.0 && (
        <div style={{ position: "absolute", left: 1090, top: 250, width: 640 }}>
          <div className="section-kicker" style={{ fontSize: 15, ...riseStyle(t, 84.1) }}>
            Di HP
          </div>
          <div className="font-display" style={{ marginTop: 12, fontSize: 56, fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.04em", color: "#072033", ...riseStyle(t, 84.2) }}>
            Notifikasi &<br />
            <span style={{ color: "#0369A1" }}>presensi kilat.</span>
          </div>
          <ol style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 14 }}>
            {STEPS.map((s, i) => {
              const done = t >= s.done;
              const running = !done && t >= s.from;
              return (
                <li
                  key={s.label}
                  className="login-step"
                  data-state={done ? "done" : running ? "running" : "pending"}
                  style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 20px", background: running ? "#DCEBF5" : "#fff", ...riseStyle(t, 84.35 + i * 0.1, 0.55, 16) }}
                >
                  <span style={{ transform: "scale(1.4)", display: "flex" }}>
                    <StepIcon state={done ? "done" : running ? "running" : "pending"} t={t} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 23, fontWeight: 700, color: done || running ? "#072033" : "#3B5A70" }}>{s.label}</span>
                    <span className="font-mono" style={{ display: "block", fontSize: 15, color: "#3B5A70", marginTop: 2 }}>
                      {s.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <FeatureTag t={t} at={T.layarIn + 0.2} icon={Smartphone} label="Rapi di semua layar" dur={4.3} />
      <Sticker t={t} at={T.kirimTap - 0.05} src="maskot/mura-presensi.png" x={1585} y={790} size={290} rotate={-3} exitAt={100.0} />
    </div>
  );
};
