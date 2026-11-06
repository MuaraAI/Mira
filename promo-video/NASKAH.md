# Naskah Video Tutorial Mira (v3)

**Durasi:** 02:16.80 (136.8 detik) · **Format:** 1920×1080, 60 fps, H.264 BT.709 · **Tempo musik:** 100 BPM (1 bar = 2.4 detik)

**Narasi:** ElevenLabs, suara **MwM** (perempuan, Indonesia), model Eleven v4 (`eleven_v4`), bahasa otomatis, stability 0,5 · similarity 0,75, kecepatan normal (persis setelan di UI ElevenLabs), dibuat per adegan lalu dipotong tepat di jeda bicara; suara tidak diberi EQ. Persona: **Mira sendiri yang bicara** (orang pertama, "aku"): dewasa, tenang, dan "ngatur". Memberi arahan singkat lalu mengambil alih urusanmu, ditutup dengan "Sisanya, biar aku yang atur."

| File | Isi |
|---|---|
| `out/mira-tutorial.mp4` | Video lengkap: narasi + SFX + musik |
| `out/mira-tutorial-tanpa-musik.mp4` | Narasi + SFX, tanpa musik |
| `out/mira-tutorial-tanpa-narasi.mp4` | SFX + musik, tanpa narasi (untuk dubbing sendiri) |
| `out/mira-tutorial-bisu.mp4` | Video tanpa audio sama sekali |
| `audio/vo.wav`, `audio/sfx.wav`, `audio/musik.wav` | Stem terpisah (48 kHz) untuk mixing ulang di editor |
| `naskah-vo.srt` | Subtitle narasi (waktu persis dari audio) |
| `naskah-teleprompter.txt` | Teks narasi polos dengan timestamp |
| `out/posting/` | Paket posting: YouTube (subtitle Jersey 25 menyatu), IG Feed 4:5, IG Reels 9:16, IG Story 3 bagian, cover, caption |

> Semua timestamp dibangkitkan otomatis dari `src/timeline.ts` dan `suara/vo/klip.json` (posisi bicara nyata tiap klip). Animasi penting dikunci ke kata yang diucapkan: ketukan tangan Mira pada "SIAKAD / MyBest / presensi", morph pada "tablet / hape", slider pada "Di portal / Di sini", telunjuk pada URL.

## Cara pakai di editor (CapCut / Premiere / DaVinci)

1. Paling praktis: pakai `mira-tutorial.mp4` apa adanya. Level akhir sekitar -15 dB RMS, puncak -1 dBFS.
2. Mau atur sendiri: pakai `mira-tutorial-bisu.mp4` + tiga stem (`vo.wav`, `sfx.wav`, `musik.wav`). Saat narasi bicara, musik di mix lengkap diturunkan -7 dB (tetap terdengar, sekitar 13 dB di bawah suara) dan SFX -8 dB; musik juga diberi kantong -3 dB di 2,5 kHz supaya suara tetap jelas.
3. Mau dubbing suara sendiri: pakai `mira-tutorial-tanpa-narasi.mp4`, import `naskah-vo.srt` sebagai panduan, rekam per baris (v01 sampai v33).
4. Fade buka (0,6 dtk dari gelap) dan fade tutup (02:15.50 sampai akhir) sudah menyatu di gambar dan audio.

## Peta adegan

| # | Waktu | Adegan | Yang terlihat di layar |
|---|---|---|---|
| 1 | 00:00.00 – 00:12.00 | Hook: ribetnya portal kampus | Halaman login elearning (data diganti Dinda): NIM, password, kode keamanan. Dashboard cuma berisi tautan ke portal lain, jendela kedua minta login lagi, lalu sesi habis dan kode keamanan baru muncul. |
| 2 | 00:12.00 – 00:19.20 | Reveal: Mira merapikan semuanya | Logo Mira jatuh di beat, enam kartu layanan berserakan. Lengan berjas Mira mengetuk dan merapikannya jadi satu kolom, garis halus menyambung ke logo, semua mengalir masuk, lalu lockup Mira + slogan Jadwal. Tugas. Satu pintu. |
| 3 | 00:19.20 – 00:33.60 | Masuk pakai akun kampus | Ketik mira.muaraai.com, klik Masuk ke Dashboard, isi NIM + password, panel verifikasi 5 tahap. Sorotan: kode keamanan otomatis, sesi aktif 7 hari. |
| 4 | 00:33.60 – 00:48.00 | Ringkasan & jadwal kuliah | Dashboard Ringkasan Dinda (kelas berikutnya, tugas, IPK), lalu halaman Jadwal Kuliah: tab Hari Ini dan Minggu Ini. |
| 5 | 00:48.00 – 01:00.00 | Tugas & pengumpulan | Halaman Tugas urut deadline, Kumpulkan, tempel link Drive, status link PUBLIK, kirim. |
| 6 | 01:00.00 – 01:14.40 | Komunitas (fitur baru) | Chat kelas: format ala WhatsApp (tebal, miring), link YouTube/WhatsApp/Instagram jadi chip rapi, reaksi, Dinda mengirim pesan dengan link Mira. |
| 7 | 01:14.40 – 01:24.00 | Rapi di semua layar | Jendela browser mundur ternyata di laptop, lalu berubah mulus jadi tablet dan HP (bingkai seragam, label perangkat + lebar layar di atas). Lup memperbesar teks di HP, panah ke kartu penjelasan kontras 15,5 : 1. |
| 8 | 01:24.00 – 01:40.80 | Notifikasi & presensi di HP | Ketuk lonceng kanan atas, Aktifkan di Perangkat Ini, izinkan. Notifikasi absen masuk di layar kunci, diketuk, langsung ke Presensi tanpa login, Kirim presensi. |
| 9 | 01:40.80 – 01:50.40 | Keamanan | Tiga panel beraksi bergantian, kamera ikut pindah: password jadi sandi acak lalu terkunci (AES-256-GCM), percobaan login menumpuk sampai DIBLOKIR, tiga sesi perangkat diakhiri sekali klik. |
| 10 | 01:50.40 – 02:04.80 | Portal kampus vs Mira | Satu bingkai browser, dua halaman di posisi yang sama: form login vs form login (slider digeser kursor), lalu dashboard vs dashboard (slider berjalan sendiri). Ditutup Mira di laptop, tablet, HP + 4 badge. |
| 11 | 02:04.80 – 02:16.80 | Outro & ajakan | Logo Mira menunjuk URL mira.muaraai.com dua kali saat dibacakan, Mura menyapa, slogan Sisanya, biar Mira yang atur., lalu memudar ke gelap. |

**Transisi sapuan pixel** (khas Mira): 00:11.55, 00:18.75, 01:40.35, 01:49.95, 02:04.35. Laptop → tablet → HP memakai morph pegas mulus (01:16.50 dan 01:17.65), bukan potongan.

## Naskah narasi per baris

Kolom *Ucapan TTS* hanya diisi bila ejaan untuk suara berbeda dari teks tampil (supaya lafal Indonesia pas).

### Hook: ribetnya portal kampus (00:00.00 – 00:12.00)

| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |
|---|---|---|---|---|---|---|
| v01 | 00:00.40 | 00:02.76 | **Mau cek jadwal? Login dulu.** |  | Datar, sedikit menyindir. | Form login portal kampus diisi; kode keamanan disorot (2.30). |
| v02 | 00:04.00 | 00:06.78 | **Sudah masuk, jadwalnya di portal lain.** |  | Heran tapi kalem. | Dashboard portal cuma berisi tautan; klik Buka Student V2, jendela login kedua muncul (6.60). |
| v03 | 00:06.95 | 00:12.49 | **15 menit kemudian, sesi habis? Hahaha, bikin kesel, kan?** | Lima belas menit kemudian, sesi habis? Hahaha, bikin kesel, kan? | Menyindir: tanya, tertawa kecil, lalu kesal. | Timer sesi berjalan lalu habis, kembali ke login dengan kode keamanan baru, Mura pusing. |

### Reveal: Mira merapikan semuanya (00:12.00 – 00:19.20)

| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |
|---|---|---|---|---|---|---|
| v04 | 00:12.60 | 00:14.11 | **Halo, aku Mira.** |  | Langsung menyambung, hangat, percaya diri. | Logo Mira jatuh di beat, kartu layanan berserakan di sekitarnya. |
| v05 | 00:14.30 | 00:18.50 | **SIAKAD, MyBest, presensi: biar aku yang atur.** |  | Biar aku yang atur: mantap. | Lengan logo merapikan kartu layanan jadi satu kolom, lalu semuanya mengalir ke logo; slogan JADWAL. TUGAS. SATU PINTU. |

### Masuk pakai akun kampus (00:19.20 – 00:33.60)

| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |
|---|---|---|---|---|---|---|
| v06 | 00:19.05 | 00:20.18 | **Caranya begini.** |  | Tenang, mengajak. | Browser muncul dari sapuan pixel. |
| v07 | 00:20.55 | 00:24.12 | **Buka mira.muaraai.com, klik Masuk.** | Buka mira dot muaraai dot com, klik Masuk. | URL dibaca: mira dot muaraai dot com. | URL diketik, landing Mira, klik Masuk ke Dashboard (23.60). |
| v08 | 00:24.80 | 00:27.80 | **Isi NIM, password SIAKAD dan MyBest.** |  | Jelas; tekan cukup sekali. | Form diisi: NIM, dua password, centang, Masuk. |
| v09 | 00:28.60 | 00:33.16 | **Kode keamanan? Aku yang isi. Sesimu aktif 7 hari.** | Kode keamanan? Aku yang isi. Sesimu aktif tujuh hari. | Yakin, menenangkan. | Panel verifikasi 5 tahap; sorotan Kode keamanan otomatis lalu Sesi aktif 7 hari. |

### Ringkasan & jadwal kuliah (00:33.60 – 00:48.00)

| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |
|---|---|---|---|---|---|---|
| v10 | 00:34.80 | 00:39.45 | **Kelas berikutnya, tugas, dan IPK: langsung kelihatan.** |  | Sebut tiap item pas sorotannya pindah. | Ringkasan Dinda; sorotan Kelas berikutnya (35.1), Tugas (36.3), IPK (37.2). |
| v11 | 00:40.60 | 00:43.36 | **Jadwal hari ini, atau seminggu penuh.** |  | Ringan. | Halaman Jadwal Kuliah tab Hari Ini, lalu klik Minggu Ini (42.75). |
| v12 | 00:43.90 | 00:47.28 | **Lengkap dengan ruang, dosen, dan tombol absen.** |  | Informatif. | Daftar seminggu bergulir per hari. |

### Tugas & pengumpulan (00:48.00 – 01:00.00)

| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |
|---|---|---|---|---|---|---|
| v13 | 00:48.20 | 00:50.74 | **Tugas, urut dari deadline terdekat.** |  | Informatif. | Halaman Tugas, chip deadline menyala berurutan. |
| v14 | 00:51.40 | 00:53.68 | **Kumpulkan? Tempel link Drive-mu.** | Kumpulkan? Tempel link Drive kamu. | Tempel: pas link muncul. | Klik Kumpulkan, panel terbuka, link ditempel (53.10). |
| v15 | 00:53.90 | 00:57.20 | **Aksesnya aku cek, biar dosen nggak dapat link privat.** |  | Tekan link privat. | Status Mengecek lalu PUBLIK (54.85), Kirim Tugas, berhasil. |

### Komunitas (fitur baru) (01:00.00 – 01:14.40)

| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |
|---|---|---|---|---|---|---|
| v16 | 00:59.95 | 01:03.87 | **Yang baru: Komunitas, ruang ngobrol kelasmu.** |  | Antusias tapi kalem. | Halaman Komunitas: ruang kelas, channel #umum, pesan teman. |
| v17 | 01:04.20 | 01:08.75 | **Format ala WhatsApp, link YouTube atau Instagram tampil rapi.** |  | Santai. | Pesan dengan teks tebal/miring, chip WhatsApp (63.70), Instagram (65.00), reaksi api. |
| v18 | 01:09.05 | 01:11.91 | **Channel, grup, sampai pesan pribadi.** |  | Santai. | Dinda kirim pesan dengan link Mira (69.10), kamera mundur memperlihatkan ruang, channel, anggota. |

### Rapi di semua layar (01:14.40 – 01:24.00)

| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |
|---|---|---|---|---|---|---|
| v19 | 01:15.00 | 01:18.27 | **Konsisten di laptop, tablet, sampai HP.** | Konsisten di laptop, tablet, sampai hape. | Laptop, tablet, HP: ikut perubahan layar. | Layar laptop berubah mulus jadi tablet (76.20) lalu HP (78.00); label perangkat di atas. |
| v20 | 01:19.30 | 01:22.78 | **Kontras teksnya tinggi, jadi mata nggak cepat lelah.** |  | Tenang, menjelaskan. | Lup memperbesar teks di HP, panah ke kartu penjelasan kontras 15,5 : 1. |

### Notifikasi & presensi di HP (01:24.00 – 01:40.80)

| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |
|---|---|---|---|---|---|---|
| v21 | 01:24.40 | 01:28.03 | **Ketuk lonceng di kanan atas, aktifkan notifikasi.** |  | Instruktif, pelan. | Ketuk lonceng (85.30), Aktifkan di Perangkat Ini (86.60), Izinkan (87.55). |
| v22 | 01:28.90 | 01:31.53 | **Absen dibuka? Aku langsung kabari.** |  | Langsung kabari: pas notifikasi absen. | Layar kunci: notifikasi kelas (89.40) dan absen (90.40). |
| v23 | 01:32.60 | 01:35.62 | **Ketuk, lalu absen. Tanpa login ulang.** |  | Tekan tanpa login ulang. | Notifikasi diketuk (92.70), halaman Presensi terbuka, Absen Sekarang, Kirim presensi (95.30). |
| v24 | 01:36.30 | 01:38.66 | **Beres, tercatat di MyBest.** |  | Puas, singkat. | Status SUDAH ABSEN + pesan berhasil. |

### Keamanan (01:40.80 – 01:50.40)

| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |
|---|---|---|---|---|---|---|
| v25 | 01:40.60 | 01:44.27 | **Akunmu aman: password-mu aku enkripsi.** | Akunmu aman. Password kamu aku enkripsi. | Serius tapi hangat. | Titik password berubah jadi sandi acak, gembok menutup (AES-256-GCM). |
| v26 | 01:44.55 | 01:47.00 | **Login berulang? Aku blokir.** |  | Tegas. | Percobaan login menumpuk, yang ke-11 DIBLOKIR. |
| v27 | 01:47.30 | 01:49.94 | **Keluar dari semua perangkat? Sekali klik.** |  | Ringan. | Tiga sesi perangkat, klik Keluar dari semua, semua sesi berakhir. |

### Portal kampus vs Mira (01:50.40 – 02:04.80)

| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |
|---|---|---|---|---|---|---|
| v28 | 01:50.55 | 01:51.74 | **Bandingkan sendiri.** |  | Menantang, kalem. | Satu bingkai browser, pembatas geser masuk: portal kampus di kiri, Mira di kanan. |
| v29 | 01:52.00 | 01:57.26 | **Di portal, login tiap 15 menit. Di sini, sekali seminggu.** | Di portal, login tiap lima belas menit. Di sini, sekali seminggu. | Tegas, berirama. | Form login vs form login; pembatas digeser kursor ke kiri dan kanan. |
| v30 | 01:57.55 | 02:01.60 | **Di sana jadwal dicari. Di sini, langsung terlihat.** |  | Tegas. | Dashboard vs dashboard; pembatas berjalan bolak-balik. |
| v31 | 02:01.90 | 02:03.88 | **Rapi di layar apa pun.** |  | Klimaks kecil. | Mira di laptop, tablet, HP + 4 badge keunggulan. |

### Outro & ajakan (02:04.80 – 02:16.80)

| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |
|---|---|---|---|---|---|---|
| v32 | 02:04.80 | 02:08.67 | **Gratis, open source, buatan mahasiswa UBSI.** |  | Hangat, bangga. | Logo Mira, badge Gratis / Open source. |
| v33 | 02:09.00 | 02:14.40 | **Buka mira.muaraai.com. Sisanya, biar aku yang atur.** | Buka mira dot muaraai dot com. Sisanya, biar aku yang atur. | URL pelan; kalimat terakhir tersenyum. | Lengan logo menunjuk URL dua kali; layar memudar ke gelap. |

## Teks narasi utuh (sekali baca)

**Hook: ribetnya portal kampus**  
Mau cek jadwal? Login dulu. Sudah masuk, jadwalnya di portal lain. 15 menit kemudian, sesi habis? Hahaha, bikin kesel, kan?

**Reveal: Mira merapikan semuanya**  
Halo, aku Mira. SIAKAD, MyBest, presensi: biar aku yang atur.

**Masuk pakai akun kampus**  
Caranya begini. Buka mira.muaraai.com, klik Masuk. Isi NIM, password SIAKAD dan MyBest. Kode keamanan? Aku yang isi. Sesimu aktif 7 hari.

**Ringkasan & jadwal kuliah**  
Kelas berikutnya, tugas, dan IPK: langsung kelihatan. Jadwal hari ini, atau seminggu penuh. Lengkap dengan ruang, dosen, dan tombol absen.

**Tugas & pengumpulan**  
Tugas, urut dari deadline terdekat. Kumpulkan? Tempel link Drive-mu. Aksesnya aku cek, biar dosen nggak dapat link privat.

**Komunitas (fitur baru)**  
Yang baru: Komunitas, ruang ngobrol kelasmu. Format ala WhatsApp, link YouTube atau Instagram tampil rapi. Channel, grup, sampai pesan pribadi.

**Rapi di semua layar**  
Konsisten di laptop, tablet, sampai HP. Kontras teksnya tinggi, jadi mata nggak cepat lelah.

**Notifikasi & presensi di HP**  
Ketuk lonceng di kanan atas, aktifkan notifikasi. Absen dibuka? Aku langsung kabari. Ketuk, lalu absen. Tanpa login ulang. Beres, tercatat di MyBest.

**Keamanan**  
Akunmu aman: password-mu aku enkripsi. Login berulang? Aku blokir. Keluar dari semua perangkat? Sekali klik.

**Portal kampus vs Mira**  
Bandingkan sendiri. Di portal, login tiap 15 menit. Di sini, sekali seminggu. Di sana jadwal dicari. Di sini, langsung terlihat. Rapi di layar apa pun.

**Outro & ajakan**  
Gratis, open source, buatan mahasiswa UBSI. Buka mira.muaraai.com. Sisanya, biar aku yang atur.

## Musik (audio/musik.wav)

| Waktu | Bagian | Isi |
|---|---|---|
| 00:00.00 – 00:12.00 | intro | Teredam (low-pass), akor Am, hi-hat tipis: suasana portal lama. Muncul pelan dari hening (fade buka 0,6 dtk). |
| 00:12.00 – 00:19.20 | drop | Masuk penuh tepat saat logo jatuh: drum, bass, pad, arpeggio pixel, melodi pendek. |
| 00:19.20 – 01:00.00 | groove | Groove utama lo-fi chiptune (Fmaj7 - Em7 - Dm7 - Cmaj7), arpeggio keluar-masuk tiap 4 bar. |
| 01:00.00 – 01:14.40 | chat | Lebih ceria: hi-hat 16-an, arpeggio satu oktaf lebih tinggi. |
| 01:14.40 – 01:24.00 | breakdown | Drum turun, pad mengembang mengikuti morph laptop -> tablet -> HP. |
| 01:24.00 – 01:40.80 | phone | Groove kembali untuk alur di HP. |
| 01:40.80 – 01:50.40 | dark | Nada minor lebih tenang (Dm7 - Bbmaj7 - Gm7 - A7sus) untuk bagian keamanan. |
| 01:50.40 – 02:04.80 | build | Energi naik untuk perbandingan, snare roll di bar terakhir. |
| 02:04.80 – 02:16.80 | outro | Resolusi ke Cmaj7 tanpa melodi (narasi penutup berjalan sampai akhir), drum berhenti, memudar bersama gambar. |

## SFX (audio/sfx.wav)

Semua SFX dibuat dengan **ElevenLabs Sound Effects** (model v3) dalam satu tema: UI modern yang bersih, lembut, tanpa gema. Ketikan keyboard dipotong per ketukan dari satu rekaman lalu dijadwalkan per huruf, supaya pas dengan teks yang muncul.

| Nama | Deskripsi (prompt) | Durasi |
|---|---|---|
| click (2 varian) | Soft computer mouse click, close and crisp, quiet modern office, dry | 0.5 dtk |
| tap (2 varian) | Soft fingertip tap on a smartphone glass screen, subtle, close-miked, dry | 0.5 dtk |
| keys | Fast typing on a quiet low-profile laptop keyboard, soft keys, steady rhythm, close-miked, dry | 4 dtk |
| whoosh | Soft airy whoosh, smooth short transition swoosh, modern and clean | 1 dtk |
| whoosh-big | Smooth cinematic whoosh transition with soft low end, modern and elegant | 1.4 dtk |
| sweep | Quick digital swipe transition with soft sparkly pixel texture, modern UI, short | 1 dtk |
| pop (2 varian) | Soft rounded UI pop, gentle bubble pop, modern app, short | 0.5 dtk |
| chime | Gentle success chime, two soft rising bell notes, modern app, warm, short tail | 1.5 dtk |
| notif | Modern smartphone notification sound, pleasant soft double ding | 1.2 dtk |
| send | Chat message sent, quick soft upward swoosh, modern messaging app | 0.6 dtk |
| receive | Chat message received, soft gentle pluck pop, modern messaging app | 0.6 dtk |
| hit | Deep soft cinematic impact with subtle boom and short airy shimmer tail, modern logo reveal, elegant, not aggressive | 2.5 dtk |
| riser | Smooth airy cinematic riser, soft swelling whoosh with subtle shimmer, builds up then stops | 2 dtk |
| morph | Smooth elastic digital morph transition, soft stretching whoosh, modern UI | 1.2 dtk |
| error | Soft UI error sound, two gentle low muted notes descending, modern app, not harsh | 0.8 dtk |
| lock | Small metal padlock clicking shut, crisp close mechanical click | 0.6 dtk |
| shimmer | Soft magical sparkle shimmer, delicate glittering chimes, subtle and short | 1.5 dtk |
| tick | Single soft clock tick, crisp and quiet | 0.5 dtk |
| stamp | Soft rubber stamp pressed on paper, short muted thud, satisfying | 0.6 dtk |
| slide | Soft UI panel slide, short gentle swish, modern app | 0.6 dtk |
| paste | Soft UI snap, quick click pop, modern app paste action | 0.5 dtk |
| cards | Light paper cards scattering onto a table, soft quick shuffle | 1 dtk |
| cloth | Soft fabric sleeve swish, quick subtle cloth movement | 0.6 dtk |
| card-slide | Paper card sliding smoothly into place on a desk, short soft swish ending with a gentle tap | 0.7 dtk |
| scramble | Quick soft digital data scramble, computer processing chatter, subtle, modern | 1 dtk |
| denied | Short firm access denied buzz, low muted tone, modern UI, not harsh | 0.7 dtk |
| drag | Soft slider drag, smooth gentle sliding friction, short | 0.8 dtk |
| outro | Gentle warm ending shimmer with soft low swell slowly fading out, elegant | 3 dtk |

### Jadwal SFX

| Waktu | Jenis | Untuk |
|---|---|---|
| 00:00.90 | ketikan | Ketik NIM |
| 00:01.75 | ketikan | Ketik password |
| 00:02.30 | whoosh | Zoom ke kode keamanan |
| 00:03.15 | ketikan | Ketik kode keamanan |
| 00:03.95 | click | Klik Masuk |
| 00:04.25 | slide | Dashboard portal muncul |
| 00:06.35 | click | Klik Buka Student V2 |
| 00:06.60 | whoosh | Jendela login kedua |
| 00:07.50 | tick | Timer sesi berjalan |
| 00:07.88 | tick | Timer sesi berjalan |
| 00:08.26 | tick | Timer sesi berjalan |
| 00:09.25 | error | Sesi habis |
| 00:09.60 | pop | Kode keamanan baru |
| 00:10.00 | pop | Stiker Mura pusing |
| 00:10.00 | riser | Naik menuju reveal |
| 00:11.55 | sweep | Sapuan pixel |
| 00:12.00 | hit | Logo Mira jatuh di beat |
| 00:12.35 | cards | Kartu layanan berserakan |
| 00:13.05 | cloth | Lengan Mira keluar |
| 00:14.25 | tap | Ketuk SIAKAD |
| 00:14.30 | card-slide | Kartu dirapikan |
| 00:15.25 | tap | Ketuk MyBest |
| 00:15.30 | card-slide | Kartu dirapikan |
| 00:16.05 | tap | Ketuk Presensi |
| 00:16.10 | card-slide | Kartu dirapikan |
| 00:16.30 | card-slide | Kartu dirapikan |
| 00:16.45 | card-slide | Kartu dirapikan |
| 00:16.60 | card-slide | Kartu dirapikan |
| 00:16.60 | shimmer | Garis muara tersambung |
| 00:16.95 | whoosh | Layanan mengalir ke logo |
| 00:17.50 | shimmer | Wordmark Mira |
| 00:17.70 | chime | Semua layanan masuk |
| 00:17.76 | stamp | Satu pintu. |
| 00:18.75 | sweep | Sapuan pixel |
| 00:20.30 | ketikan | Ketik URL |
| 00:21.50 | slide | Landing page dimuat |
| 00:23.60 | click | Klik Masuk ke Dashboard |
| 00:24.60 | click | Klik NIM |
| 00:24.70 | ketikan | Ketik NIM |
| 00:25.45 | click | Klik password SIAKAD |
| 00:25.52 | ketikan | Ketik password |
| 00:26.25 | click | Klik password MyBest |
| 00:26.32 | ketikan | Ketik password |
| 00:27.15 | click | Centang persetujuan |
| 00:27.85 | click | Klik Masuk |
| 00:30.00 | tick | Tahap selesai |
| 00:30.40 | tick | Tahap selesai |
| 00:31.70 | tick | Tahap selesai |
| 00:32.30 | chime | Akses diterima |
| 00:33.65 | slide | Dashboard masuk |
| 00:39.75 | click | Klik Jadwal Kuliah |
| 00:42.75 | click | Klik Minggu Ini |
| 00:47.75 | click | Klik Tugas Kuliah |
| 00:51.50 | click | Klik Kumpulkan |
| 00:51.60 | slide | Panel samping terbuka |
| 00:52.40 | click | Klik kolom link |
| 00:53.10 | paste | Tempel link |
| 00:54.85 | tick | Status PUBLIK |
| 00:57.20 | click | Klik Kirim Tugas |
| 00:57.70 | chime | Tugas terkirim |
| 00:59.80 | click | Klik Komunitas |
| 01:00.05 | slide | Komunitas dimuat |
| 01:03.70 | receive | Pesan masuk |
| 01:05.00 | receive | Pesan masuk |
| 01:06.20 | pop | Reaksi api |
| 01:07.00 | click | Klik kolom pesan |
| 01:07.20 | ketikan | Dinda mengetik |
| 01:08.45 | paste | Tempel link Mira |
| 01:09.10 | send | Kirim pesan |
| 01:13.30 | click | Klik Ringkasan |
| 01:14.50 | whoosh-big | Mundur: ternyata di laptop |
| 01:16.40 | morph | Laptop jadi tablet |
| 01:17.55 | morph | Tablet jadi HP |
| 01:19.20 | whoosh | Kamera bergeser |
| 01:19.45 | slide | Kartu kontras masuk |
| 01:19.60 | pop | Lup muncul |
| 01:20.10 | shimmer | Skala kontras terisi |
| 01:21.05 | chime | Lulus AAA |
| 01:23.25 | whoosh | Penjelasan keluar |
| 01:25.30 | tap | Ketuk lonceng |
| 01:25.50 | slide | Halaman Notifikasi |
| 01:26.60 | tap | Ketuk Aktifkan |
| 01:27.55 | tap | Ketuk Izinkan |
| 01:27.70 | chime | Notifikasi aktif |
| 01:29.00 | lock | Layar terkunci |
| 01:29.40 | notif | Notifikasi kelas |
| 01:30.40 | notif | Notifikasi absen |
| 01:32.70 | tap | Ketuk notifikasi |
| 01:33.00 | whoosh | Aplikasi terbuka |
| 01:34.30 | tap | Ketuk Absen Sekarang |
| 01:34.42 | slide | Konfirmasi muncul |
| 01:35.25 | pop | Stiker Mura |
| 01:35.30 | tap | Ketuk Kirim presensi |
| 01:36.05 | chime | Sudah absen |
| 01:40.35 | sweep | Sapuan pixel |
| 01:41.35 | ketikan | Password diketik |
| 01:43.00 | scramble | Password jadi sandi acak |
| 01:43.95 | lock | Gembok mengunci |
| 01:44.35 | whoosh | Kamera ke panel 2 |
| 01:44.60 | tick | Percobaan login 1 |
| 01:44.70 | tick | Percobaan login 2 |
| 01:44.80 | tick | Percobaan login 3 |
| 01:44.90 | tick | Percobaan login 4 |
| 01:45.00 | tick | Percobaan login 5 |
| 01:45.10 | tick | Percobaan login 6 |
| 01:45.20 | tick | Percobaan login 7 |
| 01:45.30 | tick | Percobaan login 8 |
| 01:45.40 | tick | Percobaan login 9 |
| 01:45.50 | tick | Percobaan login 10 |
| 01:46.10 | denied | DIBLOKIR |
| 01:46.12 | stamp | Cap DIBLOKIR |
| 01:47.05 | whoosh | Kamera ke panel 3 |
| 01:49.30 | click | Klik Keluar dari semua |
| 01:49.45 | pop | Sesi laptop berakhir |
| 01:49.58 | pop | Sesi HP berakhir |
| 01:49.65 | chime | Tiga lapis aman |
| 01:49.71 | pop | Sesi tablet berakhir |
| 01:49.95 | sweep | Sapuan pixel |
| 01:50.80 | drag | Slider pembeda masuk |
| 01:51.90 | click | Pegang slider |
| 01:51.95 | drag | Geser ke portal |
| 01:55.20 | drag | Geser ke Mira |
| 01:57.00 | drag | Kembali ke tengah |
| 01:57.30 | whoosh | Ganti ke dashboard |
| 01:57.60 | drag | Slider berjalan ke portal |
| 01:59.55 | drag | Slider berjalan ke Mira |
| 02:01.00 | drag | Slider ke tengah |
| 02:01.70 | whoosh-big | Ke tiga perangkat |
| 02:02.65 | stamp | Badge keunggulan |
| 02:02.85 | stamp | Badge keunggulan |
| 02:03.05 | stamp | Badge keunggulan |
| 02:03.25 | stamp | Badge keunggulan |
| 02:04.35 | sweep | Sapuan pixel |
| 02:05.30 | hit | Logo outro |
| 02:05.70 | cloth | Lengan keluar |
| 02:06.20 | pop | Mura menyapa |
| 02:09.35 | tap | Tunjuk URL |
| 02:10.15 | tap | Tunjuk URL |
| 02:12.00 | shimmer | Slogan penutup |
| 02:13.60 | outro | Penutup memudar |

## Catatan fakta (aman dipublikasikan)

- Kode keamanan (captcha) MyBest memang diisi otomatis oleh Mira: `solve_captcha()` di `app/modules/elearning.py`.
- Sesi portal kampus sekitar 15 menit dan Mira login ulang otomatis: komentar `app/upstream_session.py`; sesi Mira aktif 7 hari (README, halaman login).
- Keamanan: password terenkripsi AES-256-GCM, maks 10 login per menit per IP dengan blokir bertingkat, logout semua sesi (README, halaman Sesi & Keamanan).
- Kontras teks utama `#072033` di atas latar `#F7FAFC` = 15,5 : 1 (target WCAG AAA, `landing-page/DESIGN.md`). Standar AA minimal 4,5 : 1, AAA mulai 7 : 1.
- Teks notifikasi persis `app/notifier.py`; cek link publik/privat dari `app/link_check.py`; format chat ala WhatsApp & chip YouTube/Instagram dari `MessageBody.tsx`.
- Tampilan portal kampus digambar ulang dari tangkapan layar untuk perbandingan: logo resmi diganti bentuk netral, data pribadi diganti persona contoh **Dinda (NIM 15250418)**, email `dinda@example.com`, IP dokumentasi `203.0.113.24`.
- Narasi dan SFX dibuat dengan akun ElevenLabs berbayar milikmu (paket Starter); pemakaian komersial mengikuti ketentuan ElevenLabs untuk paket berbayar. Musik disintesis sendiri dari kode (orisinal).
- Disclaimer "Mira bukan aplikasi resmi UBSI" tampil di outro.

## Mengubah narasi

- Edit `text` / `ucap` di `VO` (`src/timeline.ts`), lalu `npm run vo` (butuh `ELEVENLABS_API_KEY` di `.env`; kalimat yang tidak berubah diambil dari cache, tidak memakan kredit), `npm run audio`, `npm run mux`, `npm run naskah`.
- `npm run vo` juga mentranskrip balik narasi dengan Scribe untuk mengecek lafal, dan memberi tanda bila kalimat terlalu panjang untuk slotnya.
- URL dibaca "mira dot muaraai dot com" dan "HP" dieja "hape" supaya pelafalannya pas.
