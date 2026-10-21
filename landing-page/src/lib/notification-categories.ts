/** Kategori notifikasi (harus sama dengan ALLOWED_CATEGORIES di app/channel_validation.py). */
export const NOTIFICATION_CATEGORIES = [
  { id: "kelas-mulai", label: "Kelas Segera Mulai", desc: "15 menit sebelum kelas dan saat kelas dimulai, lengkap dengan jam dan ruang." },
  { id: "absen-kuliah", label: "Pengingat Absen", desc: "Saat sesi presensi dibuka, lalu diingatkan lagi tiap 10 menit sampai kamu absen." },
  { id: "matkul-besok", label: "Pengingat Kuliah H-1", desc: "Setiap sore: jadwal matkul, jam, dan ruang untuk esok hari." },
  { id: "quiz-tugas", label: "Tugas dan Kuis MyBest", desc: "Pengingat berkala kuis atau tugas kuliah yang belum dikerjakan." },
  { id: "tugas-baru", label: "Tugas Baru", desc: "Pemberitahuan saat tugas baru terdeteksi di MyBest." },
  { id: "berita-kampus", label: "Warta Berita Kampus", desc: "Broadcast setiap ada warta dan artikel baru di portal kampus." },
  { id: "pengumuman-siakad", label: "Pengumuman SIAKAD", desc: "Pemberitahuan akademik resmi dari sistem SIAKAD." },
  { id: "nilai-keluar", label: "Rilis Nilai & KHS", desc: "Saat nilai akhir atau KHS semester dipublikasikan." },
  { id: "jadwal-ujian", label: "Jadwal & Ruang Ujian", desc: "Pengingat jadwal, ruang, dan unduhan soal UTS / UAS." },
] as const;

export type NotificationCategoryId = (typeof NOTIFICATION_CATEGORIES)[number]["id"];
