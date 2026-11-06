# Video tutorial Mira (motion graphics dari kode) · v3

Video 2:16 (1920x1080, 60 fps), dibuat dengan [Remotion](https://www.remotion.dev) (React).
UI di video bukan screenshot: halaman Mira digambar ulang dari kode `landing-page/` dengan
kelas Tailwind, font, ikon (lucide-react 0.475.0), maskot Mura, dan teks yang sama persis.
Narasi memakai suara ElevenLabs **MwM** dengan model **Eleven v4** (setelan sama dengan UI, dipotong di jeda bicara), SFX dibuat
dengan ElevenLabs Sound Effects, musik disintesis dari kode. Subtitle memakai font **Jersey 25**
(pixel, SIL OFL) dengan kata yang sedang diucapkan menyala kuning.

## Hasil

| File | Isi |
|---|---|
| `out/mira-tutorial.mp4` | Video lengkap: narasi + SFX + musik |
| `out/mira-tutorial-tanpa-musik.mp4` | Narasi + SFX |
| `out/mira-tutorial-tanpa-narasi.mp4` | SFX + musik (untuk dubbing sendiri) |
| `out/mira-tutorial-bisu.mp4` | Video tanpa audio |
| `audio/vo.wav`, `audio/sfx.wav`, `audio/musik.wav` | Stem terpisah untuk mixing ulang |
| `NASKAH.md` | Naskah lengkap: persona, peta adegan, narasi per baris + timestamp, musik, SFX |
| `naskah-vo.srt` | Subtitle narasi (waktu persis dari audio) |
| `naskah-teleprompter.txt` | Teks narasi polos dengan timestamp |
| `out/posting/youtube/` | 1920x1080 60 fps dengan subtitle, thumbnail, judul + deskripsi + chapter, .srt |
| `out/posting/instagram-feed/` | 4:5 (1080x1350) + cover + caption |
| `out/posting/instagram-reels/` | 9:16 (1080x1920) + cover + caption |
| `out/posting/instagram-story/` | 9:16 dipotong 3 bagian (di bawah 60 dtk) + teks stiker |

Caption IG, deskripsi + chapter YouTube, dan hashtag dibuat oleh `scripts/build-posting.ts`
(bagian `FITUR`, `HASHTAG`, `PEMBUAT`, `OPEN_SOURCE`, `DISCLAIMER`). Ubah di sana lalu jalankan
`node --no-warnings scripts/build-posting.ts`.

## Isi video

1. Hook: ribetnya portal kampus (login + kode keamanan, portal lain, sesi habis)
2. "Biar aku yang atur": lengan berjas logo Mira merapikan 6 layanan kampus, lalu semuanya bermuara ke logo
3. Masuk sekali (verifikasi 5 tahap, kode keamanan otomatis, sesi 7 hari)
4. Ringkasan & Jadwal Kuliah (Hari Ini / Minggu Ini)
5. Tugas: urut deadline, kumpulkan link Drive, cek akses PUBLIK
6. Komunitas: format ala WhatsApp, chip YouTube/WhatsApp/Instagram, reaksi
7. Laptop → tablet → HP: bingkai seragam, label perangkat + lebar layar, penjelasan kontras teks
8. HP: lonceng → aktifkan notifikasi → notifikasi absen → presensi tanpa login ulang
9. Keamanan: enkripsi, batas login, logout semua perangkat (tiga panel beraksi)
10. Portal kampus vs Mira: login vs login dan dashboard vs dashboard di bingkai yang sama, slider pembeda bergerak
11. Outro: URL ditunjuk saat dibacakan, "Sisanya, biar Mira yang atur.", fade ke gelap

## Perintah

```bash
npm install            # sekali saja
npm run studio         # pratinjau interaktif (scrub per frame)
npm run semua          # render video, mix audio, gabung audio, naskah, format posting
npm run render         # hanya video bisu -> out/mira-tutorial-bisu.mp4
npm run audio          # mix narasi + SFX + musik -> audio/*.wav
npm run mux            # gabung audio -> out/mira-tutorial*.mp4
npm run naskah         # tulis ulang NASKAH.md + .srt dari src/timeline.ts
npm run posting        # render format YouTube / IG Feed / IG Reels / IG Story + cover + caption
node scripts/stills.mjs 12.5 40   # render frame diam (detik) ke stills/ untuk cek cepat
```

### Narasi & SFX (ElevenLabs)

Butuh kunci API di `promo-video/.env` (sudah di-.gitignore, jangan di-commit):

```
ELEVENLABS_API_KEY=...
```

```bash
npm run vo    # narasi suara MwM (eleven_v4, bahasa Indonesia) + cek lafal via Scribe
npm run sfx   # pustaka SFX (Sound Effects v3)
```

Hasilnya di-cache di `suara/` (di-.gitignore): permintaan yang sama tidak dikirim ulang.
Narasi dibuat per adegan dengan Eleven v4 (stability 0,5, similarity 0,75, kecepatan normal),
jadi mengubah satu kalimat hanya membuat ulang adegan itu. `npm run vo` juga mentranskrip balik
tiap klip untuk memastikan tidak ada kata yang terpotong.

## Struktur

- `src/timeline.ts`: satu-satunya sumber waktu (adegan, peristiwa, narasi, cue SFX, bagian musik). Video, audio, dan naskah membaca file ini.
- `src/scenes/`: Hook, Reveal, Desktop (masuk → komunitas), Mobile (perangkat + HP), Aman, Beda, Outro.
- `src/components/`: replika UI Mira (`landing`, `login`, `dashboard`, `jadwal`, `komunitas`, `phone`, `mobile`), ilustrasi portal kampus (`elearning`), karakter logo dengan lengan IK (`logo`), primitive gerak (`motion`).
- `src/posting/Social.tsx`: format posting (YouTube, IG Feed 4:5, IG Reels/Story 9:16, cover) yang memakai video dasar.
- `src/components/subtitles.tsx`: subtitle Jersey 25; waktu per kata dari `src/vo-words.json` (dibuat `npm run vo`).
- `src/data.ts`: data contoh fiktif (persona Dinda, NIM 15250418).
- `scripts/eleven.mjs`: pembungkus REST API ElevenLabs + dekoder audio; `gen-vo.mjs`, `gen-sfx.mjs`: pembuat aset; `audio.mjs`: mixer (EQ & penyeimbang vokal, ducking, limiter, fade); `audio-check.mjs`: cek level & clipping.

## Gaya visual "Arus Pixel"

Diturunkan dari design system Mira (`landing-page/DESIGN.md`): sudut kotak, bingkai pixel 2px,
bayangan keras tanpa blur, easing `cubic-bezier(0.16, 1, 0.3, 1)`, transisi sapuan tile (sama dengan
menu HP Mira), gerak kamera & morph perangkat berbasis pegas supaya terasa lentur.
