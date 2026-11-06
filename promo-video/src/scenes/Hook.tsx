import React, { useRef } from "react";
import { Clock } from "lucide-react";
import { T } from "../timeline";
import { DEMO } from "../data";
import { EASE_CAM, EASE_GLASS, EASE_IN, EASE_PX, clamp, lerp, prog, typed } from "../lib/anim";
import { Camera, Sticker, camAt, cursorAt, type CursorKey } from "../components/motion";
import { ElearningDashboard, ElearningLogin, PlainBrowser, SecondPortalLogin } from "../components/elearning";
import { mid, useAnchors } from "../components/ui";

/**
 * Adegan 1 (v2): pengalaman portal kampus, digerakkan mulus 60 fps.
 * Friksi diceritakan lewat isinya (login berulang, kode keamanan, portal lain), bukan lewat patah-patah.
 */

/** Kursor sistem (vektor) untuk dunia portal lama. */
const SysCursor: React.FC<{ t: number; keys: CursorKey[]; init: { x: number; y: number }; clicks: number[]; show: [number, number] }> = ({ t, keys, init, clicks, show }) => {
  const vis = prog(t, show[0], 0.25, EASE_PX) * (1 - prog(t, show[1], 0.2, EASE_IN));
  if (vis <= 0) return null;
  const p = cursorAt(t, init, keys);
  const press = clicks.some((c) => t >= c && t < c + 0.12);
  return (
    <>
      {clicks.map((c) => {
        if (t < c || t > c + 0.5) return null;
        const at = cursorAt(c, init, keys);
        const u = (t - c) / 0.5;
        const r = lerp(8, 46, u);
        return <div key={c} style={{ position: "absolute", left: at.x - r, top: at.y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `3px solid rgba(124,58,237,${0.6 * (1 - u)})`, zIndex: 290 }} />;
      })}
      <svg width="34" height="46" viewBox="0 0 17 23" style={{ position: "absolute", left: p.x, top: p.y, opacity: vis, transform: `scale(${press ? 0.86 : 1})`, transformOrigin: "0 0", zIndex: 300, overflow: "visible" }}>
        <path d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L13.5 12 Z" fill="#111" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" transform="translate(0.6 0.6)" opacity="0.25" />
        <path d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L13.5 12 Z" fill="#111" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </>
  );
};

export const Hook: React.FC<{ t: number }> = ({ t }) => {
  const root = useRef<HTMLDivElement>(null);
  const a = useAnchors(root);

  const expired = t >= T.hookExpire;
  const onDash = t >= T.hookDash && !expired;

  const login = expired
    ? { nim: "", pw: 0, captchaCode: "K7P", captchaTyped: "", focus: null }
    : {
        nim: typed(DEMO.nim, t, T.hookNim, 14),
        pw: typed("••••••••", t, T.hookPw, 16).length,
        captchaCode: "3VS",
        captchaTyped: typed("3VS", t, T.hookCaptcha, 8),
        focus: (t >= 0.8 && t < 1.7 ? "nim" : t >= 1.7 && t < 3.05 ? "pw" : t >= 3.05 && t < 3.95 ? "captcha" : null) as "nim" | "pw" | "captcha" | null,
        press: t >= T.hookMasuk && t < T.hookMasuk + 0.12,
      };

  const cap = mid(a["el-captcha"], 0.5, 0.5, { x: 1350, y: 640 });
  const masuk = mid(a["el-masuk"], 0.5, 0.5, { x: 1440, y: 920 });
  const student = mid(a["el-student"], 0.5, 0.5, { x: 760, y: 720 });

  const cam = camAt(t, { x: 960, y: 540, s: 0.92 }, [
    { t: 0.15, dur: 1.8, x: 1430, y: 470, s: 1.18 },
    { t: T.hookCaptchaZoom, dur: 0.6, x: cap.x, y: cap.y + 40, s: 1.6 },
    { t: 3.55, dur: 0.5, x: 1430, y: 700, s: 1.22 },
    { t: T.hookDash, dur: 0.8, x: 960, y: 560, s: 0.92 },
    { t: 5.3, dur: 1.0, x: 980, y: 600, s: 1.08 },
    { t: 7.2, dur: 1.0, x: 980, y: 560, s: 0.96 },
    { t: T.hookExpire, dur: 0.9, x: 1250, y: 520, s: 1.05 },
  ]);

  const cursorKeys: CursorKey[] = [
    { t: 3.45, dur: 0.42, x: masuk.x + 30, y: masuk.y + 6 },
    { t: 5.6, dur: 0.7, x: student.x + 20, y: student.y + 4 },
  ];

  // Jendela kedua (portal lain) meluncur masuk dengan pegas, lalu menutup saat sesi habis.
  const win2 = Math.min(prog(t, T.hookPortal2, 0.6, EASE_GLASS), 1 - prog(t, T.hookExpire - 0.05, 0.35, EASE_IN));
  const timerIn = Math.min(prog(t, T.hookTimer - 0.2, 0.4, EASE_GLASS), 1 - prog(t, T.hookExpire + 0.5, 0.35, EASE_IN));
  const left = Math.max(0, 900 - clamp((t - T.hookTimer) / (T.hookExpire - 0.1 - T.hookTimer)) * 900);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(Math.floor(left % 60)).padStart(2, "0");
  const loginBack = prog(t, T.hookExpire, 0.45, EASE_PX);
  const enter = prog(t, 0, 0.7, EASE_GLASS);

  return (
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, #2B2F45 0%, #14172A 75%)", overflow: "hidden" }}>
      <Camera cam={cam}>
        <div ref={root} style={{ position: "relative", width: 1920, height: 1080, opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }}>
          <PlainBrowser url={expired ? "elearning.bsi.ac.id/login" : onDash ? "elearning.bsi.ac.id/user/dashboard" : "elearning.bsi.ac.id/login"} width={1920} height={1036}>
            {onDash ? (
              <div style={{ position: "absolute", inset: 0, opacity: prog(t, T.hookDash, 0.4, EASE_PX) }}>
                <ElearningDashboard hoverStudent={t >= 6.2 && t < T.hookExpire} />
              </div>
            ) : (
              <div style={{ position: "absolute", inset: 0, opacity: expired ? loginBack : 1 }}>
                <ElearningLogin t={t} s={login} />
              </div>
            )}
          </PlainBrowser>
          {win2 > 0 && (
            <div style={{ position: "absolute", left: 560, top: 240, opacity: win2, transform: `translateX(${(1 - win2) * 260}px) scale(${lerp(0.94, 1, win2)})` }}>
              <PlainBrowser url="students.bsi.ac.id/login" width={1180} height={680}>
                <SecondPortalLogin />
              </PlainBrowser>
            </div>
          )}
          <SysCursor t={t} init={{ x: 1700, y: 1000 }} keys={cursorKeys} clicks={[T.hookMasuk, T.hookStudent]} show={[3.3, 7.4]} />
        </div>
      </Camera>

      {/* Timer sesi (mempercepat 15 menit jadi 1 detik), anotasi video, bukan UI portal. */}
      {timerIn > 0 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 836,
            transform: `translateX(-50%) translateY(${(1 - timerIn) * 24}px)`,
            opacity: timerIn,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "14px 26px",
            background: "rgba(7,32,51,.92)",
            boxShadow: "0 -2px 0 0 #163A55, 0 2px 0 0 #163A55, -2px 0 0 0 #163A55, 2px 0 0 0 #163A55, 6px 6px 0 0 #BE123C",
            color: "#fff",
          }}
        >
          <Clock style={{ width: 30, height: 30, color: left === 0 ? "#FDA4AF" : "#9CC6E0" }} />
          <span className="font-mono" style={{ fontSize: 20, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9CC6E0" }}>
            {left === 0 ? "Sesi habis" : "Sesi portal"}
          </span>
          <span className="font-mono tabular" style={{ fontSize: 38, fontWeight: 700, color: left === 0 ? "#FDA4AF" : "#fff" }}>
            {mm}:{ss}
          </span>
        </div>
      )}

      <Sticker t={t} at={T.hookMura} src="maskot/mura-offline.png" x={70} y={540} size={460} rotate={-6} />
    </div>
  );
};

export { EASE_CAM };
