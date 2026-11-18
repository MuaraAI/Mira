"use client";

import { ExternalLink } from "lucide-react";
import { useApi } from "@/lib/api";
import { safeExternalHref } from "@/lib/links";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/dashboard-ui";

interface NewsItem {
  id: string;
  title: string;
  date: string;
  link: string;
  author: string;
  excerpt: string;
}

function formatDate(raw: string) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BeritaPage() {
  const newsApi = useApi<NewsItem[]>("/v1/news?per_page=20");
  const news = newsApi.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warta Berita Kampus"
        description="Berita resmi dari news.bsi.ac.id. Surat edaran, kalender akademik, dan kontak prodi ada di SIAKAD."
      />

      <div className="space-y-4">
        {newsApi.loading ? (
          <LoadingState label="Memuat warta berita kampus terkini" />
        ) : newsApi.error ? (
          <ErrorState error={newsApi.error} onRetry={newsApi.reload} />
        ) : news.length === 0 ? (
          <EmptyState
            title="Belum ada warta berita tersedia."
            description="Arsip lengkapnya ada di news.bsi.ac.id."
          />
        ) : (
          <ul className="grid gap-4">
            {news.map((item) => (
              <li key={item.id}>
                <a
                  href={safeExternalHref(item.link) || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card block p-5 transition-all hover:border-[#0369A1]/40 hover:bg-[#F0F7FB]/40 sm:p-6"
                >
                  <p className="font-mono text-xs text-secondary">
                    {formatDate(item.date)} : {item.author}
                  </p>
                  <h2 className="mt-1.5 text-base font-bold leading-snug text-foreground sm:text-lg">
                    {item.title}
                  </h2>
                  {item.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-secondary">
                      {item.excerpt}
                    </p>
                  )}
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#0369A1] hover:underline">
                    <span>Baca selengkapnya di portal kampus</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
