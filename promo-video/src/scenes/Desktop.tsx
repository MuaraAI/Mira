import React, { useRef } from "react";
import { CalendarDays, CheckSquare, LayoutDashboard, LogIn, MessagesSquare } from "lucide-react";
import { T } from "../timeline";
import { DEMO, DINDA_LINK, DINDA_MSG, DRIVE_LINK } from "../data";
import { BrowserFrame, BROWSER_W, CHROME_H, mid, useAnchors, type StepState } from "../components/ui";
import { Callout, Camera, FocusBox, MistBackground, PixelCursor, camAt, fitKeys, type CamKey, type CursorKey } from "../components/motion";
import { LandingDesktop } from "../components/landing";
import { LoginDesktop, type LoginCheckState } from "../components/login";
import { DashboardShell, RingkasanDesktop, SubmitSheet, TugasPage } from "../components/dashboard";
import { JadwalPage } from "../components/jadwal";
import { KomunitasApp } from "../components/komunitas";
import { FeatureTag } from "../components/overlay";
import { EASE_CAM, EASE_IN, EASE_PX, clamp, prog, pulse, steps, typed } from "../lib/anim";

/**
 * Satu "long take" di browser desktop: login -> Ringkasan -> Jadwal -> Tugas -> Komunitas ->
 * kembali ke Ringkasan. Kamera dan kursor mengalir terus tanpa potongan.
 */

const URL = "mira.muaraai.com";

const NavBar: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const p = steps(prog(t, at, 0.35, EASE_PX), 6);
  const out = prog(t, at + 0.4, 0.15, (v) => v);
  if (t < at || out >= 1) return null;
  return <div style={{ position: "absolute", left: 0, top: CHROME_H - 2, height: 3, width: BROWSER_W * p, background: "#0369A1", opacity: 1 - out, zIndex: 5 }} />;
};

type Page = "blank" | "landing" | "login" | "ringkasan" | "jadwal" | "tugas" | "komunitas" | "ringkasan2";

function pageAt(t: number): Page {
  if (t < T.landing) return "blank";
  if (t < T.loginLoad) return "landing";
  if (t < T.dashLoad) return "login";
  if (t < T.jadwalLoad) return "ringkasan";
  if (t < T.tugasLoad) return "jadwal";
  if (t < T.komLoad) return "tugas";
  if (t < T.ringkasanClick + 0.05) return "komunitas";
  return "ringkasan2";
}

export const Desktop: React.FC<{ t: number }> = ({ t }) => {
  const root = useRef<HTMLDivElement>(null);
  const a = useAnchors(root);
  const page = pageAt(t);

  const url =
    page === "blank"
      ? t < T.urlType
        ? ""
        : typed(URL, t, T.urlType, 14.5)
      : page === "landing"
        ? URL
        : page === "login"
          ? `${URL}/login`
          : page === "jadwal"
            ? `${URL}/dashboard/jadwal`
            : page === "tugas"
              ? `${URL}/dashboard/tugas`
              : page === "komunitas"
                ? `${URL}/dashboard/komunitas`
                : `${URL}/dashboard`;

  /* ---------------- login */
  const form = {
    nim: typed(DEMO.nim, t, T.nimType, 16),
    siakad: typed("•••••••••", t, T.siaType, 18).length,
    mybest: typed("•••••••••", t, T.mybType, 18).length,
    agree: t >= T.agreeClick,
    focus: (t >= T.nimClick && t < T.siaClick ? "nim" : t >= T.siaClick && t < T.mybClick ? "siakad" : t >= T.mybClick && t < T.agreeClick ? "mybest" : null) as "nim" | "siakad" | "mybest" | null,
    submit: (t >= T.submitClick && t < T.submitClick + 0.12 ? "press" : t >= T.submitClick - 0.2 && t < T.submitClick ? "hover" : "idle") as "idle" | "hover" | "press",
  };
  const st = (run: number, done: number): StepState => (t < run ? "pending" : t < done ? "running" : "done");
  const check: LoginCheckState = {
    appearAt: T.checkIn,
    elapsed: clamp(t, T.checkIn, T.accessOk) - T.checkIn,
    steps: {
      form: st(T.checkIn + 0.05, T.checkIn + 0.4),
      siakad: st(T.checkIn + 0.4, T.siaDone),
      mybest: st(T.checkIn + 0.4, T.mybDone),
      session: st(T.mybDone, T.sessionDone),
      redirect: st(T.sessionDone, T.accessOk),
    },
  };
  const heroBtn = t >= T.heroClick && t < T.heroClick + 0.12 ? "press" : t >= T.heroClick - 0.3 && t < T.heroClick ? "hover" : "idle";

  /* ---------------- komunitas */
  const composer = t < T.dindaType ? "" : t < T.dindaPaste ? typed(DINDA_MSG, t, T.dindaType, 18) : t < T.dindaSend ? DINDA_MSG + DINDA_LINK : "";
  const kom = {
    heights: { m3: a["msg-m3"]?.h ?? 70, m4: a["msg-m4"]?.h ?? 50, mine: a["msg-mine"]?.h ?? 70 },
    typing: t >= T.typingSalsa && t < T.msgWa,
    composer,
    sendActive: composer.length > 0,
    mineAt: t >= T.dindaSend + 0.1 ? T.dindaSend + 0.1 : null,
    mineTick: (t < T.dindaSend + 0.5 ? "sending" : "sent") as "sending" | "sent",
    reactAt: T.react,
  };

  /* ---------------- anchor */
  const masuk = mid(a["hero-masuk"], 0.5, 0.5, { x: 300, y: 560 });
  const nim = mid(a["f-nim"], 0.5, 0.5, { x: 1080, y: 380 });
  const sia = mid(a["f-siakad"], 0.5, 0.5, { x: 1080, y: 480 });
  const myb = mid(a["f-mybest"], 0.5, 0.5, { x: 1080, y: 580 });
  const agree = mid(a["f-agree"], 0.5, 0.5, { x: 870, y: 680 });
  const submit = mid(a["f-submit"], 0.5, 0.5, { x: 1080, y: 760 });
  const card = mid(a["login-card"], 0.5, 0.5, { x: 1080, y: 520 });
  const cardRect = a["login-card"] ?? { x: 856, y: 250, w: 448, h: 560 };
  const rowMyb = a["step-mybest"];
  const rowSes = a["step-session"];

  const hero = a["hero"];
  const spot = a["spotlight"];
  const mT = a["m-tugas"];
  const mA = a["m-absen"];
  const mI = a["m-ipk"];
  const navJ = mid(a["nav-/dashboard/jadwal"], 0.35, 0.5, { x: 110, y: 280 });
  const navT = mid(a["nav-/dashboard/tugas"], 0.35, 0.5, { x: 110, y: 300 });
  const navK = mid(a["nav-/dashboard/komunitas"], 0.35, 0.5, { x: 110, y: 200 });
  const navR = mid(a["nav-/dashboard"], 0.5, 0.5, { x: 32, y: 150 });
  const tab = mid(a["tab-week"], 0.5, 0.5, { x: 560, y: 260 });
  const td0 = a["today-0"];
  const td1 = a["today-1"];
  const t0 = a["task-0"];
  const t1 = a["task-1"];
  const t2 = a["task-2"];
  const submit0 = mid(a["task-0-submit"], 0.5, 0.5, { x: 700, y: 560 });
  const sheet = a["sheet"];
  const input = a["sheet-input"];
  const link = a["linkcard"];
  const msg = a["link-msg"];
  const send = mid(a["sheet-send"], 0.5, 0.5, { x: 1360, y: 900 });
  const chat = a["kom-chat"];
  const comp = mid(a["kom-composer"], 0.3, 0.5, { x: 900, y: 860 });
  const kSend = mid(a["kom-send"], 0.5, 0.5, { x: 1150, y: 860 });
  const kList = a["kom-list"];
  const kDm = a["kom-dm"];

  const heroC = hero ? { x: hero.x + hero.w / 2, y: hero.y + 140 } : { x: 840, y: 260 };
  const spotC = mid(spot, 0.5, 0.5, { x: 840, y: 330 });
  const gridC = t0 && t1 ? { x: (t0.x + t1.x + t1.w) / 2, y: t0.y + 220 } : { x: 840, y: 520 };
  const todayC = td0 && td1 ? { x: (td0.x + td1.x + td1.w) / 2, y: td0.y + 120 } : { x: 760, y: 420 };
  const sheetC = sheet ? { x: sheet.x + sheet.w / 2, y: 400 } : { x: 1150, y: 400 };
  const linkC = mid(link, 0.5, 0.5, { x: 1150, y: 420 });
  const chatC = chat ? { x: chat.x + chat.w / 2, y: chat.y + chat.h - 300 } : { x: 860, y: 620 };

  const keys: CamKey[] = [
    // masuk
    { t: 21.6, dur: 0.85, x: 720, y: 473, s: 1.04 },
    { t: 22.65, dur: 0.8, x: masuk.x + 170, y: masuk.y - 70, s: 1.32 },
    { t: 23.9, dur: 0.85, x: nim.x, y: nim.y + 130, s: 1.55 },
    { t: 25.35, dur: 0.55, x: sia.x, y: sia.y + 60, s: 1.6 },
    { t: 26.15, dur: 0.55, x: myb.x, y: myb.y + 40, s: 1.6 },
    { t: 26.95, dur: 0.65, x: submit.x, y: submit.y - 80, s: 1.55 },
    { t: 28.0, dur: 0.75, x: card.x, y: card.y - 40, s: 1.45 },
    { t: 29.0, dur: 0.7, x: card.x - 150, y: rowMyb ? rowMyb.y + rowMyb.h / 2 : 560, s: 1.75 },
    { t: 30.45, dur: 0.6, x: card.x - 150, y: rowSes ? rowSes.y + rowSes.h / 2 : 640, s: 1.75 },
    { t: 32.3, dur: 0.9, x: card.x - 230, y: card.y - 30, s: 1.3 },
    // ringkasan
    { t: 33.6, dur: 0.7, x: 720, y: 473, s: 1.04 },
    { t: 34.35, dur: 0.85, x: heroC.x, y: heroC.y, s: 1.45 },
    { t: 35.1, dur: 0.5, x: spotC.x, y: spotC.y + 30, s: 1.55 },
    { t: 36.15, dur: 0.5, x: mA && mT ? (mA.x + mT.x + mT.w) / 2 : 900, y: mT ? mT.y + mT.h / 2 : 470, s: 1.65 },
    { t: 37.05, dur: 0.5, x: mI && mA ? (mI.x + mA.x + mA.w) / 2 : 600, y: mI ? mI.y + mI.h / 2 : 470, s: 1.65 },
    { t: 38.35, dur: 0.8, x: 640, y: 430, s: 1.12 },
    // jadwal
    { t: 40.05, dur: 0.8, x: todayC.x, y: todayC.y, s: 1.3 },
    { t: 43.0, dur: 3.3, x: 820, y: 520, s: 1.2, ease: EASE_CAM },
    { t: 46.55, dur: 0.7, x: 640, y: 430, s: 1.12 },
    // tugas
    { t: 48.0, dur: 0.85, x: gridC.x, y: gridC.y, s: 1.3 },
    { t: 50.95, dur: 0.65, x: submit0.x + 60, y: submit0.y - 110, s: 1.45 },
    { t: 51.95, dur: 0.65, x: sheetC.x, y: sheetC.y, s: 1.6 },
    { t: 54.95, dur: 0.55, x: linkC.x, y: linkC.y + 30, s: 1.85 },
    { t: 56.3, dur: 0.6, x: send.x - 170, y: send.y - 230, s: 1.55 },
    { t: 57.55, dur: 0.9, x: gridC.x, y: gridC.y - 40, s: 1.18 },
    { t: 58.95, dur: 0.6, x: 640, y: 430, s: 1.12 },
    // komunitas
    { t: 60.05, dur: 0.9, x: chatC.x, y: chatC.y - 40, s: 1.5 },
    { t: 63.4, dur: 1.0, x: chatC.x, y: chatC.y + 40, s: 1.55 },
    { t: 66.35, dur: 0.6, x: comp.x + 120, y: comp.y - 150, s: 1.55 },
    { t: 69.9, dur: 1.0, x: 720, y: 473, s: 1.04 },
    { t: 70.95, dur: 0.6, x: 420, y: 420, s: 1.3 },
    { t: 72.65, dur: 0.6, x: 720, y: 473, s: 1.04 },
  ];
  const cam = camAt(t, { x: 470, y: 230, s: 1.55 }, fitKeys(keys, BROWSER_W, 946));

  const loginCursor: CursorKey[] = [
    { t: 22.6, dur: 0.75, x: masuk.x + 18, y: masuk.y + 6 },
    { t: 24.2, dur: 0.4, x: nim.x - 120, y: nim.y + 4 },
    { t: 25.18, dur: 0.27, x: sia.x - 100, y: sia.y + 4 },
    { t: 25.98, dur: 0.27, x: myb.x - 80, y: myb.y + 4 },
    { t: 26.82, dur: 0.33, x: agree.x + 2, y: agree.y + 2 },
    { t: 27.45, dur: 0.4, x: submit.x + 30, y: submit.y + 6 },
    { t: 28.0, dur: 0.5, x: submit.x + 260, y: submit.y + 160 },
  ];
  const appCursor: CursorKey[] = [
    { t: 38.9, dur: 0.6, x: navJ.x, y: navJ.y + 3 },
    { t: 42.2, dur: 0.5, x: tab.x, y: tab.y + 4 },
    { t: 43.3, dur: 0.7, x: tab.x + 520, y: tab.y + 380 },
    { t: 46.9, dur: 0.6, x: navT.x, y: navT.y + 3 },
    { t: 50.8, dur: 0.6, x: submit0.x + 14, y: submit0.y + 5 },
    { t: 51.95, dur: 0.42, x: input ? input.x + 150 : 1000, y: input ? input.y + input.h / 2 + 4 : 300 },
    { t: 56.55, dur: 0.55, x: send.x + 12, y: send.y + 6 },
    { t: 57.5, dur: 0.6, x: send.x - 120, y: send.y + 200 },
    { t: 58.9, dur: 0.7, x: navK.x, y: navK.y + 3 },
    { t: 60.4, dur: 0.8, x: chatC.x + 220, y: chatC.y + 180 },
    { t: 66.4, dur: 0.55, x: comp.x, y: comp.y + 4 },
    { t: 68.65, dur: 0.4, x: kSend.x + 4, y: kSend.y + 4 },
    { t: 69.6, dur: 0.5, x: kSend.x - 160, y: kSend.y + 120 },
    { t: 72.7, dur: 0.55, x: navR.x, y: navR.y + 3 },
    { t: 73.6, dur: 0.5, x: navR.x + 300, y: navR.y + 260 },
  ];

  const sheetOpen = Math.min(prog(t, T.submitOpen, 0.32, EASE_PX), 1 - prog(t, T.sendClick + 0.15, 0.3, EASE_IN));
  const checkState = t < T.paste + 0.15 ? "none" : t < T.linkPublic ? "checking" : "public";
  const firstDone = t >= T.sentOk + 0.05;
  const flip = prog(t, T.sentOk + 0.25, 0.68, EASE_CAM);
  const success = prog(t, T.sentOk, 0.35, EASE_PX);
  const chipFlash = (i: number) => pulse(t, 49.2 + i * 0.55, 0.45);
  const scrollWeek = page === "jadwal" ? 430 * prog(t, 43.2, 3.1, EASE_CAM) : 0;
  const expand = page === "ringkasan2" ? 1 - prog(t, T.ringkasanClick + 0.05, 0.5, EASE_CAM) : undefined;

  let content: React.ReactNode = null;
  if (page === "landing") content = <LandingDesktop t={t} load={T.landing + 0.05} btn={heroBtn} />;
  else if (page === "login") content = <LoginDesktop t={t} load={T.loginLoad} phase={t >= T.checkIn ? "checking" : "form"} form={form} check={check} />;
  else if (page !== "blank") {
    const active =
      page === "jadwal" ? "/dashboard/jadwal" : page === "tugas" ? "/dashboard/tugas" : page === "komunitas" ? "/dashboard/komunitas" : "/dashboard";
    const hover =
      page === "ringkasan" && t >= 39.45
        ? "/dashboard/jadwal"
        : page === "jadwal" && t >= 47.45
          ? "/dashboard/tugas"
          : page === "tugas" && t >= 59.5
            ? "/dashboard/komunitas"
            : page === "komunitas" && t >= 73.0
              ? "/dashboard"
              : null;
    const title = page === "jadwal" ? "Jadwal Kuliah" : page === "tugas" ? "Tugas & Deadline" : page === "komunitas" ? "Komunitas" : "Ringkasan";
    content = (
      <DashboardShell
        active={active}
        hover={hover}
        title={title}
        compact={page === "komunitas"}
        compactP={expand}
        scroll={scrollWeek}
        overlay={
          page === "tugas" ? (
            <SubmitSheet
              t={t}
              open={sheetOpen}
              linkText={t >= T.paste ? DRIVE_LINK : ""}
              focus={t >= T.inputClick && t < T.sendClick}
              check={checkState}
              sendPress={t >= T.sendClick && t < T.sendClick + 0.12}
              sendHover={t >= T.sendClick - 0.25 && t < T.sendClick}
              pasteFlash={pulse(t, T.paste, 0.35)}
            />
          ) : undefined
        }
      >
        {page === "ringkasan" && <RingkasanDesktop t={t} load={T.dashLoad} ipk={DEMO.ipk} />}
        {page === "ringkasan2" && <RingkasanDesktop t={t} load={T.ringkasanClick + 0.05} ipk={DEMO.ipk} />}
        {page === "jadwal" && <JadwalPage t={t} load={T.jadwalLoad} tab={t >= T.weekClick + 0.1 ? "week" : "today"} weekAt={T.weekClick + 0.1} hoverWeek={t >= 42.55} />}
        {page === "tugas" && (
          <TugasPage
            t={t}
            load={T.tugasLoad}
            firstDone={firstDone}
            success={success}
            chipFlash={chipFlash}
            submitPress={t >= T.submitOpen - 0.1 && t < T.submitOpen + 0.02}
            submitHover={t >= T.submitOpen - 0.35 && t < T.submitOpen - 0.1}
            flip={flip}
            slots={t0 && t1 && t2 ? [t0, t1, t2] : undefined}
          />
        )}
        {page === "komunitas" && (
          <div className="h-full" style={{ opacity: prog(t, T.komLoad, 0.4, EASE_PX), transform: `translateY(${(1 - prog(t, T.komLoad, 0.4, EASE_PX)) * 10}px)` }}>
            <KomunitasApp t={t} s={kom} />
          </div>
        )}
      </DashboardShell>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <MistBackground drift={t * 6} />
      <Camera cam={cam}>
        <div ref={root} style={{ position: "relative", width: BROWSER_W, height: 946 }}>
          <BrowserFrame url={url} caret={t >= 19.6 && t < T.landing} t={t}>
            {content}
          </BrowserFrame>
          <NavBar t={t} at={T.landing - 0.05} />
          <NavBar t={t} at={T.loginLoad - 0.15} />
          <NavBar t={t} at={T.dashLoad - 0.1} />
          <NavBar t={t} at={T.jadwalLoad - 0.1} />
          <NavBar t={t} at={T.tugasLoad - 0.1} />
          <NavBar t={t} at={T.komLoad - 0.1} />

          {/* sorotan & callout (satu per satu, tidak bertumpuk) */}
          {rowMyb && (
            <Callout t={t} start={29.05} end={30.55} x={cardRect.x - 210} y={rowMyb.y - 70} toX={rowMyb.x - 6} toY={rowMyb.y + rowMyb.h / 2} kicker="Kode keamanan" text="Diisi otomatis" />
          )}
          {rowSes && (
            <Callout t={t} start={30.8} end={33.2} x={cardRect.x - 210} y={rowSes.y - 60} toX={rowSes.x - 6} toY={rowSes.y + rowSes.h / 2} kicker="Sesi aman" text="Aktif 7 hari" tone="success" />
          )}
          {spot && page === "ringkasan" && <FocusBox t={t} start={35.15} end={36.0} x={spot.x} y={spot.y} w={spot.w} h={spot.h} />}
          {mT && page === "ringkasan" && <FocusBox t={t} start={36.3} end={37.0} x={mT.x} y={mT.y} w={mT.w} h={mT.h} color="#9A3412" />}
          {mI && page === "ringkasan" && <FocusBox t={t} start={37.2} end={38.2} x={mI.x} y={mI.y} w={mI.w} h={mI.h} />}
          {link && msg && page === "tugas" && <FocusBox t={t} start={55.1} end={56.3} x={link.x} y={link.y} w={link.w} h={msg.y + msg.h - link.y} color="#0F766E" />}
          {kList && page === "komunitas" && <FocusBox t={t} start={71.05} end={71.9} x={kList.x} y={kList.y + 56} w={kList.w} h={200} />}
          {kDm && page === "komunitas" && <FocusBox t={t} start={71.95} end={72.6} x={kDm.x} y={kDm.y} w={kDm.w} h={kDm.h} />}

          <PixelCursor t={t} init={{ x: 1180, y: 860 }} keys={loginCursor} clicks={[T.heroClick, T.nimClick, T.siaClick, T.mybClick, T.agreeClick, T.submitClick]} show={[22.0, 28.1]} />
          <PixelCursor
            t={t}
            init={{ x: 900, y: 700 }}
            keys={appCursor}
            clicks={[T.jadwalClick, T.weekClick, T.tugasNavClick, T.submitOpen - 0.1, T.inputClick, T.sendClick, T.komNavClick, T.composerClick, T.dindaSend, T.ringkasanClick]}
            show={[38.6, 74.1]}
          />
        </div>
      </Camera>

      <FeatureTag t={t} at={19.9} icon={LogIn} label="Masuk sekali" />
      <FeatureTag t={t} at={T.dashLoad + 0.2} icon={LayoutDashboard} label="Ringkasan" />
      <FeatureTag t={t} at={T.jadwalLoad + 0.15} icon={CalendarDays} label="Jadwal kuliah" />
      <FeatureTag t={t} at={T.tugasLoad + 0.15} icon={CheckSquare} label="Tugas & deadline" />
      <FeatureTag t={t} at={T.komLoad + 0.2} icon={MessagesSquare} label="Komunitas" badge="Baru" dur={3.2} />
    </div>
  );
};
