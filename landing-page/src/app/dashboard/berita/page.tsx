"use client";

import { useState } from "react";
import {
  Newspaper,
  FileText,
  Calendar,
  Mail,
  ExternalLink,
  Download,
  Search,
  Sparkles,
} from "lucide-react";
import { useApi } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  inputClass,
} from "@/components/dashboard-ui";

interface NewsItem {
  id: string;
  title: string;
  date: string;
  link: string;
  author: string;
  excerpt: string;
}

interface AnnouncementItem {
  id: string;
  title: string;
  pdf_url: string;
}

interface CalendarData {
  title?: string;
  pdf_url?: string | null;
}

interface ProdiContact {
  no: number | string;
  prodi: string;
  jenjang: string;
  kaprodi: string;
  email: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BeritaPage() {
  const [activeTab, setActiveTab] = useState<"news" | "announcements" | "info">("news");
  const [searchProdi, setSearchProdi] = useState("");

  const newsApi = useApi<NewsItem[]>("/v1/news?per_page=20");
  const announcementsApi = useApi<AnnouncementItem[]>("/v1/studentv2/announcements");
  const calendarApi = useApi<CalendarData>("/v1/studentv2/calendar");
  const contactsApi = useApi<ProdiContact[]>("/v1/studentv2/prodi-contacts");

  const news = newsApi.data ?? [];
  const announcements = announcementsApi.data ?? [];
  const calendar = calendarApi.data;
  const contacts = contactsApi.data ?? [];

  const filteredContacts = contacts.filter((c) => {
    const q = searchProdi.toLowerCase().trim();
    if (!q) return true;
    return (
      c.prodi.toLowerCase().includes(q) ||
      c.kaprodi.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col">
        <PageHeader
          title="Pusat Informasi & Berita Kampus"
          description="Kanal terpadu warta resmi, surat edaran rektorat, kalender akademik, dan direktori kontak program studi UBSI."
        />

        {/* Tab Switcher */}
        <div className="px-seg">
          <button
            type="button"
            onClick={() => setActiveTab("news")}
            className={`px-seg-btn ${
              activeTab === "news"
                ? "px-seg-on"
                : ""
            }`}
          >
            Warta Berita ({news.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("announcements")}
            className={`px-seg-btn ${
              activeTab === "announcements"
                ? "px-seg-on"
                : ""
            }`}
          >
            Edaran Rektorat ({announcements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={`px-seg-btn ${
              activeTab === "info"
                ? "px-seg-on"
                : ""
            }`}
          >
            Kalender & Kontak Prodi
          </button>
        </div>
      </div>

      {/* Tab 1: Warta Berita Kampus (news.bsi.ac.id) */}
      {activeTab === "news" && (
        <div className="space-y-4">
          {newsApi.loading ? (
            <LoadingState label="Memuat warta berita kampus terkini" />
          ) : newsApi.error ? (
            <ErrorState error={newsApi.error} onRetry={newsApi.reload} />
          ) : news.length === 0 ? (
            <EmptyState
              title="Belum ada warta berita tersedia."
              description="Kunjungi portal resmi news.bsi.ac.id untuk arsip selengkapnya."
            />
          ) : (
            <ul className="grid gap-4">
              {news.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-card block p-5 sm:p-6 hover:border-[#0369A1]/40 transition-all hover:bg-[#F0F7FB]/40"
                  >
                    <p className="text-xs font-mono text-secondary">
                      {formatDate(item.date)} : {item.author}
                    </p>
                    <h2 className="mt-1.5 text-base sm:text-lg font-bold text-foreground leading-snug">
                      {item.title}
                    </h2>
                    {item.excerpt && (
                      <p className="mt-2 text-sm text-secondary leading-relaxed line-clamp-3">
                        {item.excerpt}
                      </p>
                    )}
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#0369A1] hover:underline">
                      <span>Baca selengkapnya di portal kampus</span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Tab 2: Surat Edaran Rektorat PDF */}
      {activeTab === "announcements" && (
        <div className="space-y-4">
          {announcementsApi.loading ? (
            <LoadingState label="Memuat surat edaran resmi rektorat" />
          ) : announcementsApi.error ? (
            <ErrorState error={announcementsApi.error} onRetry={announcementsApi.reload} />
          ) : announcements.length === 0 ? (
            <EmptyState
              title="Belum ada surat edaran aktif."
              description="Surat edaran rektorat akan muncul saat diterbitkan oleh BAAK atau dekanat."
            />
          ) : (
            <div className="grid gap-3">
              {announcements.map((item) => (
                <div
                  key={item.id}
                  className="glass-card p-5 border-l-4 border-l-[#0369A1] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="space-y-1 max-w-2xl">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[10px] font-mono font-bold uppercase bg-[#F0F7FB] text-[#0369A1] border border-stroke">
                      <FileText className="w-3 h-3" />
                      Dokumen Edaran Resmi
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                      {item.title}
                    </h3>
                  </div>

                  <a
                    href={item.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[38px] items-center gap-1.5 px-4 py-2 rounded-pill bg-[#0369A1] hover:bg-[#075985] text-white text-xs font-bold transition-all shrink-0 self-start sm:self-center"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Unduh PDF</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Kalender Akademik & Direktori Kontak Prodi */}
      {activeTab === "info" && (
        <div className="space-y-6">
          {/* Kalender Card */}
          <div className="glass-card p-6 border-l-4 border-l-[#0F766E]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F766E] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Kalender Akademik Resmi UBSI
                </span>
                <h3 className="text-lg font-display font-bold text-foreground">
                  {calendar?.title || "Kalender Akademik Tahun Ajaran Berjalan"}
                </h3>
                <p className="text-xs text-secondary leading-relaxed">
                  Memuat jadwal perkuliahan, rentang minggu UTS, minggu tenang, batas UAS, dan cuti bersama kampus.
                </p>
              </div>

              {calendar?.pdf_url ? (
                <a
                  href={calendar.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-pill bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold shadow-sm transition-all shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Kalender (PDF)</span>
                </a>
              ) : (
                <span className="text-xs text-secondary italic">Berkas belum dirilis</span>
              )}
            </div>
          </div>

          {/* Direktori Kontak Kaprodi & Dekan */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-stroke flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#0369A1]" />
                  Direktori Kontak Dekanat & Program Studi
                </h3>
                <p className="text-xs text-secondary">
                  Gunakan email resmi untuk keperluan permohonan surat izin, komplain akademik, atau bimbingan prodi.
                </p>
              </div>

              <div className="w-full sm:w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary" />
                  <input
                    type="text"
                    value={searchProdi}
                    onChange={(e) => setSearchProdi(e.target.value)}
                    placeholder="Cari prodi atau nama..."
                    className={`${inputClass} pl-8 py-1.5 text-xs`}
                  />
                </div>
              </div>
            </div>

            {contactsApi.loading ? (
              <LoadingState label="Memuat direktori kontak program studi" />
            ) : filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-secondary">
                Tidak ditemukan program studi yang cocok dengan pencarian.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="px-table w-full md:min-w-[680px] text-xs text-left">
                  <thead className="sticky top-0 bg-[#F7FAFC] border-b border-stroke">
                    <tr className="font-mono uppercase tracking-wider text-secondary">
                      <th className="px-4 py-2.5">No</th>
                      <th className="px-4 py-2.5">Fakultas / Program Studi</th>
                      <th className="px-4 py-2.5 text-center">Jenjang</th>
                      <th className="px-4 py-2.5">Dekan / Ketua Program Studi</th>
                      <th className="px-4 py-2.5">Email Resmi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke/60">
                    {filteredContacts.map((c, i) => (
                      <tr key={i} className="hover:bg-[#F0F7FB]/50">
                        <td data-label="No" className="px-4 py-2.5 text-secondary font-mono">{c.no}</td>
                        <td data-label="Fakultas / Program Studi" data-primary="" className="px-4 py-2.5 font-semibold text-foreground">{c.prodi}</td>
                        <td data-label="Jenjang" className="px-4 py-2.5 text-center font-mono font-bold text-[#0369A1]">{c.jenjang}</td>
                        <td data-label="Dekan / Ketua Program Studi" data-stack="" className="px-4 py-2.5 text-secondary">{c.kaprodi}</td>
                        <td data-label="Email Resmi" data-stack="" className="px-4 py-2.5 font-mono">
                          <a
                            href={`mailto:${c.email}`}
                            className="text-[#0369A1] hover:underline flex items-center gap-1"
                          >
                            <span>{c.email}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
