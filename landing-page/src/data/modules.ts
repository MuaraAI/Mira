import { CampusModule } from "@/types";

export const CAMPUS_MODULES: CampusModule[] = [
  {
    id: "studentv2",
    name: "Students SIAKAD",
    service: "students.bsi.ac.id",
    description:
      "Ekstraksi data akademik, jadwal perkuliahan, nilai semester, pengumuman, dan rangkuman dashboard mahasiswa.",
    endpointsCount: 5,
    endpoints: [
      "/v1/studentv2/schedule",
      "/v1/studentv2/grades",
      "/v1/studentv2/dashboard",
      "/v1/studentv2/announcements",
      "/v1/studentv2/news",
    ],
    status: "Active",
  },
  {
    id: "elearning",
    name: "MyBest Elearning",
    service: "elearning.bsi.ac.id",
    description:
      "Parser kursus aktif, daftar tugas mingguan, materi kuliah, kuis, dan rekap nilai per pertemuan.",
    endpointsCount: 7,
    endpoints: [
      "/v1/elearning/courses",
      "/v1/elearning/assignments",
      "/v1/elearning/presence",
      "/v1/elearning/materials",
      "/v1/elearning/quiz",
      "/v1/elearning/grades",
      "/v1/elearning/courses/{id}/grades",
    ],
    status: "Active",
  },
  {
    id: "ejournal",
    name: "E-Journal UBSI",
    service: "ejurnal.bsi.ac.id",
    description:
      "Katalog lengkap 23 jurnal resmi aktif kampus dengan judul asli, ISSN, dan direct link OJS volume/isu terbaru.",
    endpointsCount: 1,
    endpoints: ["/v1/ejournal/journals"],
    status: "SWR",
  },
  {
    id: "elibrary",
    name: "E-Library Pustaka",
    service: "elibrary.bsi.ac.id",
    description:
      "Pencarian katalog koleksi perpustakaan, status ketersediaan buku fisik, nomor panggil, dan lokasi rak cabang kampus.",
    endpointsCount: 2,
    endpoints: ["/v1/elibrary/search", "/v1/elibrary/book/{book_id}"],
    status: "SWR",
  },
  {
    id: "repository",
    name: "Repository Karya Ilmiah",
    service: "repository.bsi.ac.id",
    description:
      "Publikasi tugas akhir, skripsi, dan riset sivitas akademika dengan penangkapan akurat rincian metadata EPrints.",
    endpointsCount: 2,
    endpoints: ["/v1/repository/recent", "/v1/repository/search"],
    status: "SWR",
  },
  {
    id: "news",
    name: "Campus News Portal",
    service: "news.bsi.ac.id",
    description:
      "Feed warta dan pengumuman resmi institusi UBSI secara real-time dengan kategori berita, tanggal, dan ringkasan.",
    endpointsCount: 2,
    endpoints: ["/v1/news", "/v1/news/{post_id}"],
    status: "Active",
  },
];
