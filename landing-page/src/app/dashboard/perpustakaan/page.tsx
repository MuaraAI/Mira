"use client";

import { useState } from "react";
import {
  Library,
  Search,
  BookOpen,
  MapPin,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { Dropdown } from "@/components/Dropdown";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  inputClass,
} from "@/components/dashboard-ui";

const COLLECTIONS = [
  { value: "buku", label: "Buku Teks" },
  { value: "semua", label: "Semua Koleksi" },
  { value: "ta", label: "Tugas Akhir" },
  { value: "skripsi", label: "Skripsi" },
  { value: "jurnal", label: "Jurnal" },
  { value: "ebook", label: "E-Book" },
];

interface BookSearchResult {
  id: string;
  title: string;
  url: string;
}

interface SearchResponse {
  total_count: number;
  items: BookSearchResult[];
}

interface BookDetail {
  kode_buku?: string | null;
  kode_klasifikasi?: string | null;
  judul_buku?: string | null;
  penulis?: string | null;
  penerbit?: string | null;
  tahun?: string | null;
  isbn?: string | null;
  stok?: string | null;
  deskripsi?: string | null;
}

export default function PerpustakaanPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("buku");
  const [submittedQuery, setSubmittedQuery] = useState("algoritma");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [bookDetail, setBookDetail] = useState<BookDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const searchApi = useApi<SearchResponse>(
    `/v1/elibrary/search?q=${encodeURIComponent(submittedQuery)}&opsi=${category}`
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      setSubmittedQuery(query.trim());
      setSelectedBookId(null);
      setBookDetail(null);
    }
  }

  async function handleSelectBook(bookId: string) {
    setSelectedBookId(bookId);
    setDetailLoading(true);
    setBookDetail(null);
    try {
      const res = await apiFetch<BookDetail>(`/v1/elibrary/book/${bookId}`);
      setBookDetail(res);
    } catch {
      // fallback
    } finally {
      setDetailLoading(false);
    }
  }

  const items = searchApi.data?.items ?? [];
  const totalCount = searchApi.data?.total_count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perpustakaan Kampus (OPAC)"
        description="Cari buku, tugas akhir, dan skripsi, lengkap dengan stoknya di tiap cabang."
      />

      {/* Search Input Box */}
      <div className="glass-card p-5 border-l-4 border-l-[#0369A1]">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul buku, topik, pengarang (misal: Python, Jaringan, Akuntansi)..."
              className={`${inputClass} pl-10`}
            />
          </div>

          <Dropdown
            ariaLabel="Pilih kategori koleksi perpustakaan"
            value={category}
            onChange={(value) => {
              setCategory(value);
              setSelectedBookId(null);
            }}
            options={COLLECTIONS}
            className="sm:w-56 sm:shrink-0"
          />

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-pill bg-[#0369A1] hover:bg-[#075985] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm shrink-0"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Cari Koleksi</span>
          </button>
        </form>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-secondary px-1">
        <span>
          Kata kunci: <strong className="text-foreground">{submittedQuery}</strong> ({category})
        </span>
        <span>Ditemukan {totalCount > 0 ? totalCount : items.length} hasil</span>
      </div>

      {searchApi.loading ? (
        <LoadingState label="Mencari koleksi perpustakaan..." />
      ) : searchApi.error ? (
        <ErrorState error={searchApi.error} onRetry={searchApi.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          mascot="/maskot/mura-buku-tumpuk.png"
          title="Tidak ada buku yang cocok."
          description="Coba kata kunci lain atau ganti kategori."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Books List (2 Cols) */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((b) => {
              const active = selectedBookId === b.id;
              return (
                <div
                  key={b.id}
                  onClick={() => handleSelectBook(b.id)}
                  className={`glass-card p-4 sm:p-5 cursor-pointer transition-all ${
                    active
                      ? "border-[#0369A1] bg-[#F0F7FB]/60 shadow-sm"
                      : "hover:border-[#0369A1]/30 hover:bg-[#F0F7FB]/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-sm bg-[#0369A1]/10 text-[#0369A1] flex items-center justify-center shrink-0 mt-0.5">
                        <BookOpen className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm sm:text-base leading-snug">
                          {b.title}
                        </h3>
                        <span className="inline-block mt-1 font-mono text-[10px] text-secondary">
                          ID: {b.id}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="text-xs font-semibold text-[#0369A1] hover:underline shrink-0"
                    >
                      {active ? "Dipilih" : "Rincian"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Book Detail Inspector (1 Col sticky) */}
          <div className="lg:col-span-1">
            <div className="glass-card p-5 sticky top-20 space-y-4">
              <h3 className="font-display font-bold text-sm text-foreground border-b border-stroke pb-3 flex items-center gap-2">
                <Library className="w-4 h-4 text-[#0369A1]" aria-hidden="true" />
                <span>Rincian Stok & Rak Buku</span>
              </h3>

              {!selectedBookId ? (
                <div className="text-center py-8 text-xs text-secondary leading-relaxed">
                  Pilih salah satu judul buku dari hasil pencarian untuk melihat nomor rak, edisi, dan ketersediaan stok fisik.
                </div>
              ) : detailLoading ? (
                <LoadingState label="Memeriksa stok cabang..." />
              ) : bookDetail ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-secondary font-bold">
                      Judul Lengkap
                    </span>
                    <span className="font-bold text-foreground text-sm">
                      {bookDetail.judul_buku || "-"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stroke/60">
                    <div>
                      <span className="block text-[10px] font-mono uppercase text-secondary font-bold">
                        Penulis
                      </span>
                      <span className="text-foreground font-medium">
                        {bookDetail.penulis || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono uppercase text-secondary font-bold">
                        Tahun & Penerbit
                      </span>
                      <span className="text-foreground">
                        {bookDetail.tahun ? `${bookDetail.tahun} | ` : ""}
                        {bookDetail.penerbit || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stroke/60">
                    <div>
                      <span className="block text-[10px] font-mono uppercase text-secondary font-bold">
                        Kode Klasifikasi
                      </span>
                      <span className="font-mono font-bold text-[#0369A1]">
                        {bookDetail.kode_klasifikasi || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono uppercase text-secondary font-bold">
                        ISBN
                      </span>
                      <span className="font-mono text-secondary">
                        {bookDetail.isbn || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stroke/60">
                    <span className="block text-[10px] font-mono uppercase text-secondary font-bold mb-1">
                      Ketersediaan Stok Fisik
                    </span>
                    <div className="p-2.5 rounded-sm bg-[#F0F7FB] border border-stroke text-foreground font-semibold">
                      {bookDetail.stok || "Stok tersedia di perpustakaan cabang kampus."}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-secondary">
                  Gagal memuat detail buku.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
