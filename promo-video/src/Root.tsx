import "./style.css";
import { Composition } from "remotion";
import { MiraTutorial } from "./MiraTutorial";
import { DURATION, FPS, HEIGHT, STORY_PARTS, WIDTH } from "./timeline";
import { loadMiraFonts } from "./lib/fonts";
import { MiraCover, MiraFeed, MiraReels, MiraStory, MiraYouTube } from "./posting/Social";

loadMiraFonts();

/** Format sosial dirender 30 fps (Instagram menayangkan 30 fps); YouTube tetap 60 fps. */
const SOCIAL_FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Video dasar (tanpa subtitle): sumber semua format */}
      <Composition id="MiraTutorial" component={MiraTutorial} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={WIDTH} height={HEIGHT} />
      {/* Format posting (memakai public/render/base.mp4 + mix-lengkap.wav) */}
      <Composition id="MiraYouTube" component={MiraYouTube} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={1920} height={1080} />
      <Composition id="MiraReels" component={MiraReels} durationInFrames={Math.round(DURATION * SOCIAL_FPS)} fps={SOCIAL_FPS} width={1080} height={1920} />
      {STORY_PARTS.map((p, i) => (
        <Composition key={i} id={`MiraStory${i + 1}`} component={MiraStory} defaultProps={{ part: i }} durationInFrames={Math.round((p.to - p.from) * SOCIAL_FPS)} fps={SOCIAL_FPS} width={1080} height={1920} />
      ))}
      <Composition id="MiraFeed" component={MiraFeed} durationInFrames={Math.round(DURATION * SOCIAL_FPS)} fps={SOCIAL_FPS} width={1080} height={1350} />
      <Composition id="CoverYouTube" component={MiraCover} defaultProps={{ kind: "youtube" as const }} durationInFrames={1} fps={SOCIAL_FPS} width={1280} height={720} />
      <Composition id="CoverFeed" component={MiraCover} defaultProps={{ kind: "feed" as const }} durationInFrames={1} fps={SOCIAL_FPS} width={1080} height={1350} />
      <Composition id="CoverStory" component={MiraCover} defaultProps={{ kind: "story" as const }} durationInFrames={1} fps={SOCIAL_FPS} width={1080} height={1920} />
    </>
  );
};
