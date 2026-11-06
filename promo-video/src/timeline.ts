/**
 * SATU-SATUNYA sumber waktu untuk video, SFX, musik, narasi, DAN naskah (v3).
 * Semua angka dalam detik global. Potongan adegan dikunci ke ketukan musik
 * (100 BPM, 1 bar = 2.4 detik) supaya editannya terasa "jatuh di beat".
 *
 * File ini sengaja tanpa import supaya bisa dibaca langsung oleh Node (type stripping)
 * untuk membangun audio (scripts/audio.mjs) dan naskah (scripts/build-naskah.ts).
 */

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const BPM = 100;
export const BAR = (60 / BPM) * 4; // 2.4 detik
export const DURATION = 57 * BAR; // 136.8 detik (outro diberi 1 bar ekstra untuk narasi penutup)

export type SceneId = "hook" | "reveal" | "masuk" | "jadwal" | "tugas" | "komunitas" | "layar" | "hp" | "aman" | "beda" | "outro";

export interface Scene {
  id: SceneId;
  start: number;
  end: number;
  judul: string;
  visual: string;
}

export interface Sweep {
  inStart: number;
  hold: number;
  outStart: number;
  end: number;
}

export interface VoLine {
  id: string;
  scene: SceneId;
  start: number;
  end: number;
  text: string;
  /** Ejaan khusus untuk TTS (lafal Indonesia). Kosong = sama dengan text. */
  ucap?: string;
  layar: string;
  arahan?: string;
}

export type SfxType =
  | "click"
  | "tap"
  | "type"
  | "whoosh"
  | "whoosh-big"
  | "sweep"
  | "pop"
  | "chime"
  | "notif"
  | "send"
  | "receive"
  | "hit"
  | "riser"
  | "morph"
  | "error"
  | "lock"
  | "shimmer"
  | "tick"
  | "stamp"
  | "slide"
  | "paste"
  | "cards"
  | "cloth"
  | "card-slide"
  | "scramble"
  | "denied"
  | "drag"
  | "outro";

export interface Cue {
  t: number;
  type: SfxType;
  /** untuk "type": jumlah ketukan dan kecepatan karakter per detik */
  n?: number;
  cps?: number;
  /** 0..1 posisi horizontal di layar untuk panning stereo */
  pan?: number;
  gain?: number;
  label: string;
}

/** Bar ke-n (detik). */
export const bar = (n: number) => n * BAR;

/* ------------------------------------------------------------------ adegan */

export const SCENES: Scene[] = [
  { id: "hook", start: 0, end: bar(5), judul: "Hook: ribetnya portal kampus", visual: "Halaman login elearning (data diganti Dinda): NIM, password, kode keamanan. Dashboard cuma berisi tautan ke portal lain, jendela kedua minta login lagi, lalu sesi habis dan kode keamanan baru muncul." },
  { id: "reveal", start: bar(5), end: bar(8), judul: "Reveal: Mira merapikan semuanya", visual: "Logo Mira jatuh di beat, enam kartu layanan berserakan. Lengan berjas Mira mengetuk dan merapikannya jadi satu kolom, garis halus menyambung ke logo, semua mengalir masuk, lalu lockup Mira + slogan Jadwal. Tugas. Satu pintu." },
  { id: "masuk", start: bar(8), end: bar(14), judul: "Masuk pakai akun kampus", visual: "Ketik mira.muaraai.com, klik Masuk ke Dashboard, isi NIM + password, panel verifikasi 5 tahap. Sorotan: kode keamanan otomatis, sesi aktif 7 hari." },
  { id: "jadwal", start: bar(14), end: bar(20), judul: "Ringkasan & jadwal kuliah", visual: "Dashboard Ringkasan Dinda (kelas berikutnya, tugas, IPK), lalu halaman Jadwal Kuliah: tab Hari Ini dan Minggu Ini." },
  { id: "tugas", start: bar(20), end: bar(25), judul: "Tugas & pengumpulan", visual: "Halaman Tugas urut deadline, Kumpulkan, tempel link Drive, status link PUBLIK, kirim." },
  { id: "komunitas", start: bar(25), end: bar(31), judul: "Komunitas (fitur baru)", visual: "Chat kelas: format ala WhatsApp (tebal, miring), link YouTube/WhatsApp/Instagram jadi chip rapi, reaksi, Dinda mengirim pesan dengan link Mira." },
  { id: "layar", start: bar(31), end: bar(35), judul: "Rapi di semua layar", visual: "Jendela browser mundur ternyata di laptop, lalu berubah mulus jadi tablet dan HP (bingkai seragam, label perangkat + lebar layar di atas). Lup memperbesar teks di HP, panah ke kartu penjelasan kontras 15,5 : 1." },
  { id: "hp", start: bar(35), end: bar(42), judul: "Notifikasi & presensi di HP", visual: "Ketuk lonceng kanan atas, Aktifkan di Perangkat Ini, izinkan. Notifikasi absen masuk di layar kunci, diketuk, langsung ke Presensi tanpa login, Kirim presensi." },
  { id: "aman", start: bar(42), end: bar(46), judul: "Keamanan", visual: "Tiga panel beraksi bergantian, kamera ikut pindah: password jadi sandi acak lalu terkunci (AES-256-GCM), percobaan login menumpuk sampai DIBLOKIR, tiga sesi perangkat diakhiri sekali klik." },
  { id: "beda", start: bar(46), end: bar(52), judul: "Portal kampus vs Mira", visual: "Satu bingkai browser, dua halaman di posisi yang sama: form login vs form login (slider digeser kursor), lalu dashboard vs dashboard (slider berjalan sendiri). Ditutup Mira di laptop, tablet, HP + 4 badge." },
  { id: "outro", start: bar(52), end: DURATION, judul: "Outro & ajakan", visual: "Logo Mira menunjuk URL mira.muaraai.com dua kali saat dibacakan, Mura menyapa, slogan Sisanya, biar Mira yang atur., lalu memudar ke gelap." },
];

/** Nama bab singkat: chip di versi IG dan chapter di deskripsi YouTube. */
export const BAB: Record<SceneId, string> = {
  hook: "Ribetnya portal kampus",
  reveal: "Kenalan dengan Mira",
  masuk: "Masuk sekali",
  jadwal: "Ringkasan & jadwal",
  tugas: "Kumpulkan tugas",
  komunitas: "Komunitas kelas",
  layar: "Rapi di semua layar",
  hp: "Notifikasi & presensi",
  aman: "Keamanan akun",
  beda: "Portal kampus vs Mira",
  outro: "Coba sekarang",
};

/** Potongan IG Story (maks 60 dtk per story), dipotong di pergantian adegan. */
export const STORY_PARTS = [
  { from: 0, to: 48.0 },
  { from: 48.0, to: 100.8 },
  { from: 100.8, to: DURATION },
];

export const SWEEPS: Sweep[] = [
  { inStart: bar(5) - 0.45, hold: bar(5), outStart: bar(5) + 0.1, end: bar(5) + 0.55 },
  { inStart: bar(8) - 0.45, hold: bar(8), outStart: bar(8) + 0.1, end: bar(8) + 0.55 },
  { inStart: bar(42) - 0.45, hold: bar(42), outStart: bar(42) + 0.1, end: bar(42) + 0.55 },
  { inStart: bar(46) - 0.45, hold: bar(46), outStart: bar(46) + 0.1, end: bar(46) + 0.55 },
  { inStart: bar(52) - 0.45, hold: bar(52), outStart: bar(52) + 0.1, end: bar(52) + 0.55 },
];

/* ------------------------------------------------------------------ peristiwa (dipakai adegan & SFX) */

export const T = {
  // Hook (portal kampus)
  hookNim: 0.9,
  hookPw: 1.75,
  hookCaptchaZoom: 2.3,
  hookCaptcha: 3.15,
  hookMasuk: 3.95,
  hookDash: 4.25,
  hookStudent: 6.35,
  hookPortal2: 6.6,
  hookTimer: 7.5,
  hookExpire: 9.25,
  hookNewCaptcha: 9.6,
  hookMura: 10.0,
  // Reveal: logo jatuh, kartu berserakan, tangan Mira merapikan, mengalir ke logo
  logoIn: bar(5),
  chipsIn: bar(5) + 0.35,
  armOut: bar(5) + 1.05,
  tap1: 14.25, // "SIAKAD"
  tap2: 15.25, // "MyBest"
  tap3: 16.05, // "presensi"
  sweep: 16.12,
  connect: 16.6,
  absorb: 16.95, // "biar aku yang atur"
  lockup: 17.2,
  slogan: 17.5,
  // Masuk
  urlType: 20.3,
  landing: 21.55,
  heroClick: 23.6,
  loginLoad: 23.85,
  nimClick: 24.6,
  nimType: 24.7,
  siaClick: 25.45,
  siaType: 25.52,
  mybClick: 26.25,
  mybType: 26.32,
  agreeClick: 27.15,
  submitClick: 27.85,
  checkIn: 28.0,
  siaDone: 30.0,
  mybDone: 30.4,
  sessionDone: 31.7,
  accessOk: 32.3,
  // Ringkasan & jadwal
  dashLoad: bar(14) + 0.05,
  jadwalClick: 39.75,
  jadwalLoad: 39.95,
  weekClick: 42.75,
  tugasNavClick: 47.75,
  // Tugas
  tugasLoad: 47.95,
  submitOpen: 51.6,
  inputClick: 52.4,
  paste: 53.1,
  linkPublic: 54.85,
  sendClick: 57.2,
  sentOk: 57.7,
  komNavClick: 59.8,
  // Komunitas
  komLoad: bar(25),
  typingSalsa: 62.4,
  msgWa: 63.7,
  msgIg: 65.0,
  react: 66.2,
  composerClick: 67.0,
  dindaType: 67.2,
  dindaPaste: 68.45,
  dindaSend: 69.1,
  ringkasanClick: 73.3,
  // Layar: browser mundur jadi laptop, morph ke tablet & HP, lalu penjelasan kontras
  layarIn: bar(31),
  morphTablet: 76.5, // "tablet"
  morphPhone: 77.65, // "hape"
  contrastIn: 79.2,
  contrastMeter: 80.1, // "tinggi"
  contrastOut: 83.25,
  // HP
  bellTap: 85.3,
  notifPage: 85.5,
  aktifkanTap: 86.6,
  izinkanTap: 87.55,
  lockScreen: 89.0,
  pushClass: 89.4,
  pushAbsen: 90.4,
  pushTap: 92.7,
  presensiOpen: 93.0,
  absenTap: 94.3,
  kirimTap: 95.3,
  absenOk: 96.05,
  // Aman: tiga panel beraksi
  amanIn: bar(42),
  pwType: 101.35,
  encrypt: 103.0, // "enkripsi"
  lockShut: 103.95,
  panel2: 104.45,
  attempts: 104.6, // "login berulang"
  blocked: 106.1, // "aku blokir"
  panel3: 107.15,
  logoutClick: 109.3, // "sekali klik"
  loggedOut: 109.45,
  overview: 109.65,
  // Beda: login vs login, dashboard vs dashboard, slider pembeda
  bedaIn: bar(46),
  dividerIn: 110.85,
  drag1: 111.95, // "Di portal"
  drag2: 115.2, // "Di sini"
  drag3: 117.0,
  swap: 117.3,
  walk1: 117.6, // "Di sana"
  walk2: 119.55, // "Di sini"
  walk3: 121.0,
  summary: 121.7,
  // Outro
  outroLogo: bar(52) + 0.5,
  outroArm: bar(52) + 0.9,
  outroMura: bar(52) + 1.4,
  outroPoint: bar(52) + 1.8,
  poke1: 129.35, // "mira"
  poke2: 130.15, // "muara"
  tagline: 132.0, // "Sisanya, biar aku yang atur"
  fadeOut: 135.5,
};

/* ------------------------------------------------------------------ voice-over (v3)
 * Persona: Mira sendiri yang bicara (orang pertama, "aku"): dewasa, tenang, dan "ngatur",
 * memberi arahan singkat lalu mengambil alih urusanmu. Suara: ElevenLabs "MwM" (eleven_v4, id).
 * text = teks tampil (subtitle/naskah); ucap = ejaan untuk TTS supaya lafal Indonesia pas
 * (mis. "HP" dibaca "hape", URL dibaca "mira dot muaraai dot com"). Posisi akhir tiap kalimat diambil dari
 * hasil TTS (suara/vo/klip.json), jadi subtitle selalu pas dengan suara. */

export const VO: VoLine[] = [
  // HOOK
  { id: "v01", scene: "hook", start: 0.4, end: 3.9, text: "Mau cek jadwal? Login dulu.", layar: "Form login portal kampus diisi; kode keamanan disorot (2.30).", arahan: "Datar, sedikit menyindir." },
  { id: "v02", scene: "hook", start: 4.0, end: 6.8, text: "Sudah masuk, jadwalnya di portal lain.", layar: "Dashboard portal cuma berisi tautan; klik Buka Student V2, jendela login kedua muncul (6.60).", arahan: "Heran tapi kalem." },
  { id: "v03", scene: "hook", start: 6.95, end: 12.6, text: "15 menit kemudian, sesi habis? Hahaha, bikin kesel, kan?", ucap: "Lima belas menit kemudian, sesi habis? Hahaha, bikin kesel, kan?", layar: "Timer sesi berjalan lalu habis, kembali ke login dengan kode keamanan baru, Mura pusing.", arahan: "Menyindir: tanya, tertawa kecil, lalu kesal." },
  // REVEAL
  { id: "v04", scene: "reveal", start: 12.6, end: 14.2, text: "Halo, aku Mira.", layar: "Logo Mira jatuh di beat, kartu layanan berserakan di sekitarnya.", arahan: "Langsung menyambung, hangat, percaya diri." },
  { id: "v05", scene: "reveal", start: 14.3, end: 18.4, text: "SIAKAD, MyBest, presensi: biar aku yang atur.", layar: "Lengan logo merapikan kartu layanan jadi satu kolom, lalu semuanya mengalir ke logo; slogan JADWAL. TUGAS. SATU PINTU.", arahan: "Biar aku yang atur: mantap." },
  // MASUK
  { id: "v06", scene: "masuk", start: 19.05, end: 20.8, text: "Caranya begini.", layar: "Browser muncul dari sapuan pixel.", arahan: "Tenang, mengajak." },
  { id: "v07", scene: "masuk", start: 20.55, end: 24.4, text: "Buka mira.muaraai.com, klik Masuk.", ucap: "Buka mira dot muaraai dot com, klik Masuk.", layar: "URL diketik, landing Mira, klik Masuk ke Dashboard (23.60).", arahan: "URL dibaca: mira dot muaraai dot com." },
  { id: "v08", scene: "masuk", start: 24.8, end: 28.2, text: "Isi NIM, password SIAKAD dan MyBest.", layar: "Form diisi: NIM, dua password, centang, Masuk.", arahan: "Jelas; tekan cukup sekali." },
  { id: "v09", scene: "masuk", start: 28.6, end: 33.2, text: "Kode keamanan? Aku yang isi. Sesimu aktif 7 hari.", ucap: "Kode keamanan? Aku yang isi. Sesimu aktif tujuh hari.", layar: "Panel verifikasi 5 tahap; sorotan Kode keamanan otomatis lalu Sesi aktif 7 hari.", arahan: "Yakin, menenangkan." },
  // JADWAL
  { id: "v10", scene: "jadwal", start: 34.8, end: 38.6, text: "Kelas berikutnya, tugas, dan IPK: langsung kelihatan.", layar: "Ringkasan Dinda; sorotan Kelas berikutnya (35.1), Tugas (36.3), IPK (37.2).", arahan: "Sebut tiap item pas sorotannya pindah." },
  { id: "v11", scene: "jadwal", start: 40.6, end: 43.6, text: "Jadwal hari ini, atau seminggu penuh.", layar: "Halaman Jadwal Kuliah tab Hari Ini, lalu klik Minggu Ini (42.75).", arahan: "Ringan." },
  { id: "v12", scene: "jadwal", start: 43.9, end: 47.2, text: "Lengkap dengan ruang, dosen, dan tombol absen.", layar: "Daftar seminggu bergulir per hari.", arahan: "Informatif." },
  // TUGAS
  { id: "v13", scene: "tugas", start: 48.2, end: 51.0, text: "Tugas, urut dari deadline terdekat.", layar: "Halaman Tugas, chip deadline menyala berurutan.", arahan: "Informatif." },
  { id: "v14", scene: "tugas", start: 51.4, end: 53.7, text: "Kumpulkan? Tempel link Drive-mu.", ucap: "Kumpulkan? Tempel link Drive kamu.", layar: "Klik Kumpulkan, panel terbuka, link ditempel (53.10).", arahan: "Tempel: pas link muncul." },
  { id: "v15", scene: "tugas", start: 53.9, end: 57.8, text: "Aksesnya aku cek, biar dosen nggak dapat link privat.", layar: "Status Mengecek lalu PUBLIK (54.85), Kirim Tugas, berhasil.", arahan: "Tekan link privat." },
  // KOMUNITAS
  { id: "v16", scene: "komunitas", start: 59.95, end: 63.6, text: "Yang baru: Komunitas, ruang ngobrol kelasmu.", layar: "Halaman Komunitas: ruang kelas, channel #umum, pesan teman.", arahan: "Antusias tapi kalem." },
  { id: "v17", scene: "komunitas", start: 64.2, end: 68.4, text: "Format ala WhatsApp, link YouTube atau Instagram tampil rapi.", layar: "Pesan dengan teks tebal/miring, chip WhatsApp (63.70), Instagram (65.00), reaksi api.", arahan: "Santai." },
  { id: "v18", scene: "komunitas", start: 69.05, end: 72.6, text: "Channel, grup, sampai pesan pribadi.", layar: "Dinda kirim pesan dengan link Mira (69.10), kamera mundur memperlihatkan ruang, channel, anggota.", arahan: "Santai." },
  // LAYAR
  { id: "v19", scene: "layar", start: 75.0, end: 78.8, text: "Konsisten di laptop, tablet, sampai HP.", ucap: "Konsisten di laptop, tablet, sampai hape.", layar: "Layar laptop berubah mulus jadi tablet (76.20) lalu HP (78.00); label perangkat di atas.", arahan: "Laptop, tablet, HP: ikut perubahan layar." },
  { id: "v20", scene: "layar", start: 79.3, end: 83.6, text: "Kontras teksnya tinggi, jadi mata nggak cepat lelah.", layar: "Lup memperbesar teks di HP, panah ke kartu penjelasan kontras 15,5 : 1.", arahan: "Tenang, menjelaskan." },
  // HP
  { id: "v21", scene: "hp", start: 84.4, end: 88.6, text: "Ketuk lonceng di kanan atas, aktifkan notifikasi.", layar: "Ketuk lonceng (85.30), Aktifkan di Perangkat Ini (86.60), Izinkan (87.55).", arahan: "Instruktif, pelan." },
  { id: "v22", scene: "hp", start: 88.9, end: 92.4, text: "Absen dibuka? Aku langsung kabari.", layar: "Layar kunci: notifikasi kelas (89.40) dan absen (90.40).", arahan: "Langsung kabari: pas notifikasi absen." },
  { id: "v23", scene: "hp", start: 92.6, end: 96.0, text: "Ketuk, lalu absen. Tanpa login ulang.", layar: "Notifikasi diketuk (92.70), halaman Presensi terbuka, Absen Sekarang, Kirim presensi (95.30).", arahan: "Tekan tanpa login ulang." },
  { id: "v24", scene: "hp", start: 96.3, end: 98.6, text: "Beres, tercatat di MyBest.", layar: "Status SUDAH ABSEN + pesan berhasil.", arahan: "Puas, singkat." },
  // AMAN
  { id: "v25", scene: "aman", start: 100.6, end: 104.0, text: "Akunmu aman: password-mu aku enkripsi.", ucap: "Akunmu aman. Password kamu aku enkripsi.", layar: "Titik password berubah jadi sandi acak, gembok menutup (AES-256-GCM).", arahan: "Serius tapi hangat." },
  { id: "v26", scene: "aman", start: 104.55, end: 106.8, text: "Login berulang? Aku blokir.", layar: "Percobaan login menumpuk, yang ke-11 DIBLOKIR.", arahan: "Tegas." },
  { id: "v27", scene: "aman", start: 107.3, end: 110.0, text: "Keluar dari semua perangkat? Sekali klik.", layar: "Tiga sesi perangkat, klik Keluar dari semua, semua sesi berakhir.", arahan: "Ringan." },
  // BEDA
  { id: "v28", scene: "beda", start: 110.55, end: 112.0, text: "Bandingkan sendiri.", layar: "Satu bingkai browser, pembatas geser masuk: portal kampus di kiri, Mira di kanan.", arahan: "Menantang, kalem." },
  { id: "v29", scene: "beda", start: 112.0, end: 116.4, text: "Di portal, login tiap 15 menit. Di sini, sekali seminggu.", ucap: "Di portal, login tiap lima belas menit. Di sini, sekali seminggu.", layar: "Form login vs form login; pembatas digeser kursor ke kiri dan kanan.", arahan: "Tegas, berirama." },
  { id: "v30", scene: "beda", start: 117.55, end: 120.4, text: "Di sana jadwal dicari. Di sini, langsung terlihat.", layar: "Dashboard vs dashboard; pembatas berjalan bolak-balik.", arahan: "Tegas." },
  { id: "v31", scene: "beda", start: 121.9, end: 124.4, text: "Rapi di layar apa pun.", layar: "Mira di laptop, tablet, HP + 4 badge keunggulan.", arahan: "Klimaks kecil." },
  // OUTRO
  { id: "v32", scene: "outro", start: 124.8, end: 128.3, text: "Gratis, open source, buatan mahasiswa UBSI.", layar: "Logo Mira, badge Gratis / Open source.", arahan: "Hangat, bangga." },
  { id: "v33", scene: "outro", start: 129.0, end: 133.0, text: "Buka mira.muaraai.com. Sisanya, biar aku yang atur.", ucap: "Buka mira dot muaraai dot com. Sisanya, biar aku yang atur.", layar: "Lengan logo menunjuk URL dua kali; layar memudar ke gelap.", arahan: "URL pelan; kalimat terakhir tersenyum." },
];

/* ------------------------------------------------------------------ SFX (dirender scripts/audio.mjs) */

const P = (t: number, type: SfxType, label: string, extra: Partial<Cue> = {}): Cue => ({ t, type, label, ...extra });

export const CUES: Cue[] = [
  // Hook
  P(T.hookNim, "type", "Ketik NIM", { n: 8, cps: 14, pan: 0.62 }),
  P(T.hookPw, "type", "Ketik password", { n: 8, cps: 16, pan: 0.62 }),
  P(T.hookCaptchaZoom, "whoosh", "Zoom ke kode keamanan", { gain: 0.6 }),
  P(T.hookCaptcha, "type", "Ketik kode keamanan", { n: 3, cps: 8, pan: 0.62 }),
  P(T.hookMasuk, "click", "Klik Masuk", { pan: 0.62 }),
  P(T.hookDash, "slide", "Dashboard portal muncul"),
  P(T.hookStudent, "click", "Klik Buka Student V2", { pan: 0.55 }),
  P(T.hookPortal2, "whoosh", "Jendela login kedua", { gain: 0.4 }),
  P(T.hookTimer, "tick", "Timer sesi berjalan", { gain: 0.8 }),
  P(T.hookTimer + 0.38, "tick", "Timer sesi berjalan", { gain: 0.75 }),
  P(T.hookTimer + 0.76, "tick", "Timer sesi berjalan", { gain: 0.7 }),
  P(T.hookExpire, "error", "Sesi habis"),
  P(T.hookNewCaptcha, "pop", "Kode keamanan baru", { gain: 0.8 }),
  P(T.hookMura, "pop", "Stiker Mura pusing", { pan: 0.25, gain: 0.8 }),
  P(bar(5) - 2.0, "riser", "Naik menuju reveal"),
  P(SWEEPS[0].inStart, "sweep", "Sapuan pixel"),
  // Reveal
  P(T.logoIn, "hit", "Logo Mira jatuh di beat"),
  P(T.chipsIn, "cards", "Kartu layanan berserakan", { pan: 0.35 }),
  P(T.armOut, "cloth", "Lengan Mira keluar", { pan: 0.45 }),
  P(T.tap1, "tap", "Ketuk SIAKAD", { pan: 0.4 }),
  P(T.tap1 + 0.05, "card-slide", "Kartu dirapikan", { pan: 0.3 }),
  P(T.tap2, "tap", "Ketuk MyBest", { pan: 0.38 }),
  P(T.tap2 + 0.05, "card-slide", "Kartu dirapikan", { pan: 0.28 }),
  P(T.tap3, "tap", "Ketuk Presensi", { pan: 0.4 }),
  P(T.tap3 + 0.05, "card-slide", "Kartu dirapikan", { pan: 0.3 }),
  P(T.sweep + 0.18, "card-slide", "Kartu dirapikan", { pan: 0.28, gain: 0.6 }),
  P(T.sweep + 0.33, "card-slide", "Kartu dirapikan", { pan: 0.3, gain: 0.55 }),
  P(T.sweep + 0.48, "card-slide", "Kartu dirapikan", { pan: 0.28, gain: 0.5 }),
  P(T.connect, "shimmer", "Garis muara tersambung", { pan: 0.45, gain: 0.8 }),
  P(T.absorb, "whoosh", "Layanan mengalir ke logo", { pan: 0.55 }),
  P(T.absorb + 0.75, "chime", "Semua layanan masuk", { gain: 0.7 }),
  P(T.lockup + 0.3, "shimmer", "Wordmark Mira", { gain: 0.7 }),
  P(T.slogan + 0.26, "stamp", "Satu pintu.", { gain: 0.6 }),
  P(SWEEPS[1].inStart, "sweep", "Sapuan pixel"),
  // Masuk
  P(T.urlType, "type", "Ketik URL", { n: 16, cps: 14.5, pan: 0.35 }),
  P(T.landing - 0.05, "slide", "Landing page dimuat"),
  P(T.heroClick, "click", "Klik Masuk ke Dashboard", { pan: 0.35 }),
  P(T.nimClick, "click", "Klik NIM", { pan: 0.6, gain: 0.6 }),
  P(T.nimType, "type", "Ketik NIM", { n: 8, cps: 16, pan: 0.6 }),
  P(T.siaClick, "click", "Klik password SIAKAD", { pan: 0.6, gain: 0.6 }),
  P(T.siaType, "type", "Ketik password", { n: 9, cps: 18, pan: 0.6 }),
  P(T.mybClick, "click", "Klik password MyBest", { pan: 0.6, gain: 0.6 }),
  P(T.mybType, "type", "Ketik password", { n: 9, cps: 18, pan: 0.6 }),
  P(T.agreeClick, "click", "Centang persetujuan", { pan: 0.55 }),
  P(T.submitClick, "click", "Klik Masuk", { pan: 0.6 }),
  P(T.siaDone, "tick", "Tahap selesai"),
  P(T.mybDone, "tick", "Tahap selesai"),
  P(T.sessionDone, "tick", "Tahap selesai"),
  P(T.accessOk, "chime", "Akses diterima", { gain: 0.6 }),
  // Ringkasan & jadwal
  P(T.dashLoad, "slide", "Dashboard masuk"),
  P(T.jadwalClick, "click", "Klik Jadwal Kuliah", { pan: 0.15 }),
  P(T.weekClick, "click", "Klik Minggu Ini", { pan: 0.4 }),
  P(T.tugasNavClick, "click", "Klik Tugas Kuliah", { pan: 0.15 }),
  // Tugas
  P(T.submitOpen - 0.1, "click", "Klik Kumpulkan", { pan: 0.45 }),
  P(T.submitOpen, "slide", "Panel samping terbuka", { pan: 0.75 }),
  P(T.inputClick, "click", "Klik kolom link", { pan: 0.7, gain: 0.6 }),
  P(T.paste, "paste", "Tempel link", { pan: 0.7 }),
  P(T.linkPublic, "tick", "Status PUBLIK", { pan: 0.7, gain: 0.6 }),
  P(T.sendClick, "click", "Klik Kirim Tugas", { pan: 0.8 }),
  P(T.sentOk, "chime", "Tugas terkirim"),
  P(T.komNavClick, "click", "Klik Komunitas", { pan: 0.1 }),
  // Komunitas
  P(T.komLoad + 0.05, "slide", "Komunitas dimuat"),
  P(T.msgWa, "receive", "Pesan masuk", { pan: 0.4 }),
  P(T.msgIg, "receive", "Pesan masuk", { pan: 0.4 }),
  P(T.react, "pop", "Reaksi api", { pan: 0.4, gain: 0.7 }),
  P(T.composerClick, "click", "Klik kolom pesan", { pan: 0.55, gain: 0.6 }),
  P(T.dindaType, "type", "Dinda mengetik", { n: 20, cps: 18, pan: 0.55 }),
  P(T.dindaPaste, "paste", "Tempel link Mira", { pan: 0.55 }),
  P(T.dindaSend, "send", "Kirim pesan", { pan: 0.75 }),
  P(T.ringkasanClick, "click", "Klik Ringkasan", { pan: 0.05 }),
  // Layar
  P(T.layarIn + 0.1, "whoosh-big", "Mundur: ternyata di laptop", { gain: 0.8 }),
  P(T.morphTablet - 0.1, "morph", "Laptop jadi tablet", { gain: 0.7 }),
  P(T.morphPhone - 0.1, "morph", "Tablet jadi HP", { gain: 0.55 }),
  P(T.contrastIn, "whoosh", "Kamera bergeser", { gain: 0.6 }),
  P(T.contrastIn + 0.4, "pop", "Lup muncul", { pan: 0.35, gain: 0.7 }),
  P(T.contrastIn + 0.25, "slide", "Kartu kontras masuk", { pan: 0.7 }),
  P(T.contrastMeter, "shimmer", "Skala kontras terisi", { pan: 0.7, gain: 0.7 }),
  P(T.contrastMeter + 0.95, "chime", "Lulus AAA", { pan: 0.7, gain: 0.55 }),
  P(T.contrastOut, "whoosh", "Penjelasan keluar", { gain: 0.5 }),
  // HP
  P(T.bellTap, "tap", "Ketuk lonceng", { pan: 0.55 }),
  P(T.notifPage, "slide", "Halaman Notifikasi"),
  P(T.aktifkanTap, "tap", "Ketuk Aktifkan", { pan: 0.45 }),
  P(T.izinkanTap, "tap", "Ketuk Izinkan", { pan: 0.5 }),
  P(T.izinkanTap + 0.15, "chime", "Notifikasi aktif", { gain: 0.6 }),
  P(T.lockScreen, "lock", "Layar terkunci", { gain: 0.7 }),
  P(T.pushClass, "notif", "Notifikasi kelas"),
  P(T.pushAbsen, "notif", "Notifikasi absen"),
  P(T.pushTap, "tap", "Ketuk notifikasi", { pan: 0.45 }),
  P(T.presensiOpen, "whoosh", "Aplikasi terbuka", { gain: 0.6 }),
  P(T.absenTap, "tap", "Ketuk Absen Sekarang", { pan: 0.45 }),
  P(T.absenTap + 0.12, "slide", "Konfirmasi muncul"),
  P(T.kirimTap, "tap", "Ketuk Kirim presensi", { pan: 0.5 }),
  P(T.kirimTap - 0.05, "pop", "Stiker Mura", { pan: 0.85, gain: 0.6 }),
  P(T.absenOk, "chime", "Sudah absen"),
  P(SWEEPS[2].inStart, "sweep", "Sapuan pixel"),
  // Aman
  P(T.pwType, "type", "Password diketik", { n: 9, cps: 14, pan: 0.3 }),
  P(T.encrypt, "scramble", "Password jadi sandi acak", { pan: 0.3 }),
  P(T.lockShut, "lock", "Gembok mengunci", { pan: 0.3 }),
  P(T.panel2 - 0.1, "whoosh", "Kamera ke panel 2", { gain: 0.5 }),
  ...Array.from({ length: 10 }, (_, i) => P(T.attempts + i * 0.1, "tick", `Percobaan login ${i + 1}`, { gain: 0.45 + i * 0.03 })),
  P(T.blocked, "denied", "DIBLOKIR"),
  P(T.blocked + 0.02, "stamp", "Cap DIBLOKIR", { gain: 0.7 }),
  P(T.panel3 - 0.1, "whoosh", "Kamera ke panel 3", { gain: 0.5 }),
  P(T.logoutClick, "click", "Klik Keluar dari semua", { pan: 0.7 }),
  P(T.loggedOut, "pop", "Sesi laptop berakhir", { pan: 0.7, gain: 0.55 }),
  P(T.loggedOut + 0.13, "pop", "Sesi HP berakhir", { pan: 0.72, gain: 0.5 }),
  P(T.loggedOut + 0.26, "pop", "Sesi tablet berakhir", { pan: 0.74, gain: 0.45 }),
  P(T.overview, "chime", "Tiga lapis aman", { gain: 0.6 }),
  P(SWEEPS[3].inStart, "sweep", "Sapuan pixel"),
  // Beda
  P(T.dividerIn - 0.05, "drag", "Slider pembeda masuk"),
  P(T.drag1 - 0.05, "click", "Pegang slider", { gain: 0.6 }),
  P(T.drag1, "drag", "Geser ke portal", { pan: 0.65 }),
  P(T.drag2, "drag", "Geser ke Mira", { pan: 0.35 }),
  P(T.drag3, "drag", "Kembali ke tengah", { gain: 0.6 }),
  P(T.swap, "whoosh", "Ganti ke dashboard"),
  P(T.walk1, "drag", "Slider berjalan ke portal", { pan: 0.65, gain: 0.6 }),
  P(T.walk2, "drag", "Slider berjalan ke Mira", { pan: 0.35, gain: 0.6 }),
  P(T.walk3, "drag", "Slider ke tengah", { gain: 0.45 }),
  P(T.summary, "whoosh-big", "Ke tiga perangkat", { gain: 0.7 }),
  ...[0, 1, 2, 3].map((i) => P(T.summary + 0.95 + i * 0.2, "stamp", "Badge keunggulan", { gain: 0.5, pan: 0.3 + i * 0.13 })),
  P(SWEEPS[4].inStart, "sweep", "Sapuan pixel", { gain: 0.45 }),
  // Outro
  P(T.outroLogo, "hit", "Logo outro", { gain: 0.6 }),
  P(T.outroArm, "cloth", "Lengan keluar", { pan: 0.2 }),
  P(T.outroMura, "pop", "Mura menyapa", { pan: 0.8, gain: 0.6 }),
  P(T.poke1, "tap", "Tunjuk URL", { pan: 0.35, gain: 0.7 }),
  P(T.poke2, "tap", "Tunjuk URL", { pan: 0.35, gain: 0.7 }),
  P(T.tagline, "shimmer", "Slogan penutup", { gain: 0.7 }),
  P(T.tagline + 1.6, "outro", "Penutup memudar", { gain: 0.8 }),
];

/* ------------------------------------------------------------------ bagian musik (scripts/audio.mjs) */

export type MusicSection = "intro" | "drop" | "groove" | "chat" | "breakdown" | "phone" | "dark" | "build" | "outro";

export const MUSIC: { from: number; to: number; section: MusicSection }[] = [
  { from: 0, to: bar(5), section: "intro" },
  { from: bar(5), to: bar(8), section: "drop" },
  { from: bar(8), to: bar(25), section: "groove" },
  { from: bar(25), to: bar(31), section: "chat" },
  { from: bar(31), to: bar(35), section: "breakdown" },
  { from: bar(35), to: bar(42), section: "phone" },
  { from: bar(42), to: bar(46), section: "dark" },
  { from: bar(46), to: bar(52), section: "build" },
  { from: bar(52), to: DURATION, section: "outro" },
];

/** Detik ke frame. */
export const f = (sec: number) => Math.round(sec * FPS);

/** Format 00:12.40 untuk naskah. */
export function stamp(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}
