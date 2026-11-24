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

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  hellip: "...",
};

function decodeHtmlEntities(raw: string): string {
  if (!raw) return "";
  return raw.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const cp = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    }
    if (code.startsWith("#")) {
      const cp = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
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
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Warta Berita Kampus"
        description="Berita resmi dari news.bsi.ac.id. Surat edaran dan warta kampus."
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
          <ul className="grid gap-3.5">
            {news.map((item) => {
              const title = decodeHtmlEntities(item.title);
              const excerpt = decodeHtmlEntities(item.excerpt);
              return (
                <li key={item.id} className="min-w-0">
                  <a
                    href={safeExternalHref(item.link) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-[10px] border-[1px] border-stroke bg-white p-5 transition-colors hover:border-[#9CC6E0] hover:bg-[#FAFDFE] sm:p-6"
                  >
                    <p className="font-mono text-xs text-secondary">
                      {formatDate(item.date)} · {item.author}
                    </p>
                    <h2 className="mt-1.5 break-words text-base font-semibold leading-snug text-foreground sm:text-lg">
                      {title}
                    </h2>
                    {excerpt && (
                      <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-secondary">
                        {excerpt}
                      </p>
                    )}
                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0369A1] hover:underline">
                      <span>Baca selengkapnya di portal kampus</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
