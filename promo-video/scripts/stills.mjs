// Render beberapa frame diam (PNG) untuk QA visual tanpa render video penuh.
// Pakai: node scripts/stills.mjs 12.5 23.4 40.1   (detik)  [--scale=0.5] [--comp=MiraReels]
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind";

const args = process.argv.slice(2);
const scaleArg = args.find((a) => a.startsWith("--scale="));
const scale = scaleArg ? Number(scaleArg.split("=")[1]) : 0.5;
const times = args.filter((a) => !a.startsWith("--")).map(Number);
const compArg = args.find((a) => a.startsWith("--comp="));
const compId = compArg ? compArg.split("=")[1] : "MiraTutorial";

const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  webpackOverride: (c) => enableTailwind(c),
});
const browser = await openBrowser("chrome");
const composition = await selectComposition({ serveUrl, id: compId, puppeteerInstance: browser });
const FPS = composition.fps;
fs.mkdirSync("stills", { recursive: true });
for (const s of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(s * FPS));
  const output = path.resolve("stills", `${compId === "MiraTutorial" ? "" : compId + "-"}t${s.toFixed(2).padStart(6, "0")}.png`);
  await renderStill({ composition, serveUrl, frame, output, scale, imageFormat: "png", puppeteerInstance: browser });
  console.log("still", s, "->", output);
}
await browser.close({ silent: true });
