"use client";

import { useApi } from "@/lib/api";
import { API_BASE_URL, API_DOCS_URL, MCP_URL } from "@/lib/public-links";

interface PublicApiInfo {
  title?: string;
  version?: string;
  description?: string;
  base_url?: string;
  mcp_url?: string;
  auth_methods?: { type?: string; description?: string }[];
}

interface PublicApiDocs {
  info?: PublicApiInfo;
  endpoints?: Record<string, { path: string; method: string; auth?: string; description?: string }[]>;
}

const categoryLabels: Record<string, string> = {
  auth: "Autentikasi",
  studentv2: "SIAKAD",
  elearning: "MyBest",
  library: "Perpustakaan",
  news: "Berita",
  repository: "Repository",
  ejournal: "E-Journal",
  channels: "Channels",
  stats: "Statistik",
  system: "Sistem",
};

export function PublicApiSurface() {
  const { data, loading, error, reload } = useApi<PublicApiDocs>("/v1/docs", { ttlMs: 300_000 });
  const info = data?.info;
  const categories = Object.entries(data?.endpoints ?? {}).filter(([, endpoints]) => endpoints.length > 0);

  return (
    <section id="api" className="border-b-2 border-px-soft bg-surface-alt/60" aria-labelledby="public-api-title">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:px-8">
        <div className="min-w-0">
          <p className="section-kicker mb-4">Untuk developer dan AI agent</p>
          <h2 id="public-api-title" className="max-w-lg font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
            Dokumentasi yang bisa langsung dipakai.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-secondary">
            Lihat kategori endpoint, kebutuhan autentikasi, dan alamat layanan dari katalog publik. Data pribadi tetap hanya tersedia setelah pengguna login.
          </p>

          <div id="mcp" className="px-card mt-8 scroll-mt-28 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="px-icon h-9 w-9 font-mono text-[11px] font-bold" aria-hidden="true">MCP</span>
              <p className="font-display text-lg font-semibold text-foreground">MCP untuk integrasi agent</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-secondary">Gunakan server MCP live untuk menghubungkan agent ke layanan UBSI dengan Personal API Key milik pengguna.</p>
            <code className="mt-3 block break-all font-mono text-xs font-semibold text-[#075985]">{info?.mcp_url ?? MCP_URL}</code>
            <div className="mt-4 bg-[#131B26] shadow-[0_-2px_0_0_#0B2D46,0_2px_0_0_#0B2D46,-2px_0_0_0_#0B2D46,2px_0_0_0_#0B2D46,4px_4px_0_0_#0369A1]">
              <div className="flex items-center gap-1.5 border-b-2 border-[#0B2D46] px-3 py-2" aria-hidden="true">
                <span className="h-2 w-2 bg-[#BE123C]" />
                <span className="h-2 w-2 bg-px-sun" />
                <span className="h-2 w-2 bg-[#0F766E]" />
              </div>
              <pre className="overflow-x-auto p-3 font-mono text-xs leading-6 text-[#CFE8F5]"><code>{`curl ${API_BASE_URL}/v1/news \\
  -H "Authorization: Bearer YOUR_PERSONAL_API_KEY"`}</code></pre>
            </div>
          </div>
        </div>

        <div className="px-card min-w-0 self-start bg-white p-5 sm:p-7">
          {loading && (
            <p className="font-mono text-sm text-secondary" role="status">
              Memuat katalog API...<span className="px-cursor" aria-hidden="true">_</span>
            </p>
          )}
          {error && !loading && (
            <div role="alert">
              <p className="font-semibold text-[#9F1239]">Katalog API belum dapat dimuat.</p>
              <p className="mt-1 text-sm text-secondary">Buka dokumentasi publik atau coba lagi.</p>
              <div className="mt-5 flex flex-wrap gap-4">
                <button type="button" onClick={reload} className="px-btn-ghost px-btn-ghost-danger min-h-11 px-4 py-2 text-sm font-semibold">Coba lagi</button>
                <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="px-btn inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold">Buka dokumentasi</a>
              </div>
            </div>
          )}
          {!loading && !error && categories.length === 0 && <p className="text-sm text-secondary">Kategori endpoint belum tersedia.</p>}
          {!loading && !error && categories.length > 0 && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-dashed border-px-soft pb-4">
                <div>
                  <p className="font-display text-xl font-semibold text-foreground">{info?.title ?? "UBSI API"}</p>
                  <p className="mt-1 text-sm text-secondary">Katalog publik {info?.version ? `v${info.version}` : "endpoint"}</p>
                </div>
                <code className="max-w-full break-all text-right font-mono text-xs text-[#075985]">{info?.base_url ?? API_DOCS_URL.replace("/v1/docs", "")}</code>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {categories.map(([key, endpoints]) => (
                  <div key={key} className="min-w-0 bg-[#F7FAFC] p-3 shadow-[0_-2px_0_0_#D9E5ED,0_2px_0_0_#D9E5ED,-2px_0_0_0_#D9E5ED,2px_0_0_0_#D9E5ED] transition-[box-shadow,transform] duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_-2px_0_0_#9CC6E0,0_2px_0_0_#9CC6E0,-2px_0_0_0_#9CC6E0,2px_0_0_0_#9CC6E0,4px_4px_0_0_#0369A1]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="h-1.5 w-1.5 shrink-0 bg-[#0369A1]" aria-hidden="true" />
                        {categoryLabels[key] ?? key}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-secondary">{endpoints.length} endpoint</span>
                    </div>
                    <p className="mt-2 truncate font-mono text-[11px] text-[#075985]">{endpoints[0]?.method} {endpoints[0]?.path}</p>
                  </div>
                ))}
              </div>
              <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="px-btn mt-7 inline-flex min-h-11 items-center gap-2 px-5 py-3 text-sm font-bold">
                Lihat katalog lengkap
                <span aria-hidden="true">→</span>
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
