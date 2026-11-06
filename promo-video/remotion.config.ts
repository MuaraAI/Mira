import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind";

// Tailwind 3 dengan tema yang sama persis dengan landing-page Mira (lihat tailwind.config.js).
Config.overrideWebpackConfig((current) => enableTailwind(current));

// Frame PNG (lossless) + BT.709 supaya hasil H.264 standar yuv420p (tv range):
// warna brand Mira (#072033, #0369A1) konsisten di CapCut, Premiere, DaVinci, dan browser.
Config.setVideoImageFormat("png");
Config.setColorSpace("bt709");
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);
