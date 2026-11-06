// Pustaka SFX v3: semua efek suara dibuat dengan ElevenLabs Sound Effects (model v3),
// satu tema: UI modern yang bersih, lembut, kering (tanpa gema), tanpa musik/suara orang.
//   node --env-file=.env scripts/gen-sfx.mjs
// Hasil di suara/sfx/<nama>.opus (di-cache; yang sudah ada tidak dibuat ulang).
import { credits, soundEffect } from "./eleven.mjs";

const STYLE = ", clean high quality sound effect, no music, no voice";
export const LIB = {
  click: { text: "Soft computer mouse click, close and crisp, quiet modern office, dry", d: 0.5, n: 2 },
  tap: { text: "Soft fingertip tap on a smartphone glass screen, subtle, close-miked, dry", d: 0.5, n: 2 },
  keys: { text: "Fast typing on a quiet low-profile laptop keyboard, soft keys, steady rhythm, close-miked, dry", d: 4.0 },
  whoosh: { text: "Soft airy whoosh, smooth short transition swoosh, modern and clean", d: 1.0 },
  "whoosh-big": { text: "Smooth cinematic whoosh transition with soft low end, modern and elegant", d: 1.4 },
  sweep: { text: "Quick digital swipe transition with soft sparkly pixel texture, modern UI, short", d: 1.0 },
  pop: { text: "Soft rounded UI pop, gentle bubble pop, modern app, short", d: 0.5, n: 2 },
  chime: { text: "Gentle success chime, two soft rising bell notes, modern app, warm, short tail", d: 1.5 },
  notif: { text: "Modern smartphone notification sound, pleasant soft double ding", d: 1.2 },
  send: { text: "Chat message sent, quick soft upward swoosh, modern messaging app", d: 0.6 },
  receive: { text: "Chat message received, soft gentle pluck pop, modern messaging app", d: 0.6 },
  hit: { text: "Deep soft cinematic impact with subtle boom and short airy shimmer tail, modern logo reveal, elegant, not aggressive", d: 2.5 },
  riser: { text: "Smooth airy cinematic riser, soft swelling whoosh with subtle shimmer, builds up then stops", d: 2.0 },
  morph: { text: "Smooth elastic digital morph transition, soft stretching whoosh, modern UI", d: 1.2 },
  error: { text: "Soft UI error sound, two gentle low muted notes descending, modern app, not harsh", d: 0.8 },
  lock: { text: "Small metal padlock clicking shut, crisp close mechanical click", d: 0.6 },
  shimmer: { text: "Soft magical sparkle shimmer, delicate glittering chimes, subtle and short", d: 1.5 },
  tick: { text: "Single soft clock tick, crisp and quiet", d: 0.5 },
  stamp: { text: "Soft rubber stamp pressed on paper, short muted thud, satisfying", d: 0.6 },
  slide: { text: "Soft UI panel slide, short gentle swish, modern app", d: 0.6 },
  paste: { text: "Soft UI snap, quick click pop, modern app paste action", d: 0.5 },
  cards: { text: "Light paper cards scattering onto a table, soft quick shuffle", d: 1.0 },
  cloth: { text: "Soft fabric sleeve swish, quick subtle cloth movement", d: 0.6 },
  "card-slide": { text: "Paper card sliding smoothly into place on a desk, short soft swish ending with a gentle tap", d: 0.7 },
  scramble: { text: "Quick soft digital data scramble, computer processing chatter, subtle, modern", d: 1.0 },
  denied: { text: "Short firm access denied buzz, low muted tone, modern UI, not harsh", d: 0.7 },
  drag: { text: "Soft slider drag, smooth gentle sliding friction, short", d: 0.8 },
  outro: { text: "Gentle warm ending shimmer with soft low swell slowly fading out, elegant", d: 3.0 },
};

if (process.argv[1]?.endsWith("gen-sfx.mjs")) {
  const before = await credits();
  for (const [name, s] of Object.entries(LIB)) {
    for (let i = 0; i < (s.n ?? 1); i++) {
      const file = `suara/sfx/${name}${s.n ? `-${i + 1}` : ""}`;
      const r = await soundEffect(file, { text: s.text + STYLE, duration_seconds: s.d, prompt_influence: 0.55, model_id: "eleven_text_to_sound_v3", _variant: i });
      console.log(`${file}: ${r.cached ? "cache" : "baru"}`);
    }
  }
  const after = await credits();
  console.log(`Kredit terpakai: ${after.used - before.used} | sisa ${after.left}`);
}
