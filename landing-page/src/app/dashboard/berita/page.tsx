"use client";

import { useApi } from "@/lib/api";
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
  const { data, loading, error, reload } = useApi<NewsItem[]>("/v1/news?per_page=20");

  if (loading) return <LoadingState label="Memuat berita kampus" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const news = data ?? [];
  if (news.length === 0) {
    return (
      <div>
        <PageHeader title="Berita Kampus" />
        <EmptyState
          title="Belum ada berita tersedia."
          description="Coba muat ulang halaman, atau kunjungi news.bsi.ac.id langsung."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Berita Kampus"
        description="Berita resmi dari portal berita UBSI. Klik judul untuk membuka sumber asli."
      />

      <ul className="grid gap-4">
        {news.map((item) => (
          <li key={item.id}>
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card block p-5 sm:p-6"
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
              <span className="mt-3 inline-block text-sm font-semibold text-[#0369a1] underline underline-offset-4">
                Baca selengkapnya
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
