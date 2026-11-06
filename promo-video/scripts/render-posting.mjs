// Render semua format posting dari video dasar (out/mira-tutorial-bisu.mp4) + mix lengkap.
//   node scripts/render-posting.mjs                 semua format
//   node scripts/render-posting.mjs youtube story   hanya sebagian (youtube|reels|story|feed|cover)
// Hasil di out/posting/ (YouTube, IG Feed, IG Reels, IG Story) + cover/thumbnail.
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind";

const want = new Set(process.argv.slice(2));
const on = (k) => want.size === 0 || want.has(k);

for (const [src, dst] of [
  ["out/mira-tutorial-bisu.mp4", "public/render/base.mp4"],
  ["audio/mix-lengkap.wav", "public/render/mix-lengkap.wav"],
]) {
  if (!fs.existsSync(src)) throw new Error(`${src} belum ada: jalankan npm run render && npm run audio dulu`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (!fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(src).mtimeMs) fs.copyFileSync(src, dst);
}

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride: (c) => enableTailwind(c) });
const browser = await openBrowser("chrome");

const jobs = [];
if (on("youtube")) jobs.push(["MiraYouTube", "out/posting/youtube/mira-tutorial-youtube-1080p60.mp4", 16]);
if (on("reels")) jobs.push(["MiraReels", "out/posting/instagram-reels/mira-reels-9x16.mp4", 17]);
if (on("story")) for (let i = 1; i <= 3; i++) jobs.push([`MiraStory${i}`, `out/posting/instagram-story/mira-story-${i}-dari-3.mp4`, 17]);
if (on("feed")) jobs.push(["MiraFeed", "out/posting/instagram-feed/mira-feed-4x5.mp4", 17]);

for (const [id, out, crf] of jobs) {
  const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const t0 = Date.now();
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf,
    outputLocation: out,
    puppeteerInstance: browser,
    concurrency: 6,
    imageFormat: "jpeg",
    jpegQuality: 95,
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    audioCodec: "aac",
    audioBitrate: "256k",
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 10);
      if (p !== last) (last = p), process.stdout.write(`${id} ${p * 10}%  `);
    },
  });
  console.log(`\n${id} -> ${out} (${((Date.now() - t0) / 60000).toFixed(1)} menit)`);
}

if (on("cover")) {
  for (const [id, out, fmt] of [
    ["CoverYouTube", "out/posting/youtube/thumbnail-youtube.jpg", "jpeg"],
    ["CoverFeed", "out/posting/instagram-feed/cover-feed-4x5.png", "png"],
    ["CoverStory", "out/posting/instagram-reels/cover-reels-9x16.png", "png"],
  ]) {
    const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await renderStill({ composition, serveUrl, frame: 0, output: out, imageFormat: fmt, ...(fmt === "jpeg" ? { jpegQuality: 92 } : {}), puppeteerInstance: browser });
    console.log(`${id} -> ${out}`);
  }
}
await browser.close({ silent: true });
