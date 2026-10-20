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
    <section id="api" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="public-api-title">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div>
          <p className="section-kicker mb-4">Untuk developer dan AI agent</p>
          <h2 id="public-api-title" className="max-w-lg font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
            Dokumentasi yang bisa langsung dipakai.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-secondary">
            Lihat kategori endpoint, kebutuhan autentikasi, dan alamat layanan dari katalog publik. Data pribadi tetap hanya tersedia setelah pengguna login.
          </p>

          <div id="mcp" className="mt-8 scroll-mt-24 border-l-2 border-[#0369A1] pl-5">
            <p className="font-display text-lg font-semibold text-foreground">MCP untuk integrasi agent</p>
            <p className="mt-2 text-sm leading-6 text-secondary">Gunakan server MCP live untuk menghubungkan agent ke layanan UBSI dengan Personal API Key milik pengguna.</p>
            <code className="mt-3 block break-all font-mono text-xs text-[#075985]">{info?.mcp_url ?? MCP_URL}</code>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-[#131B26] p-3 font-mono text-xs leading-6 text-[#CFE8F5]"><code>{`curl ${API_BASE_URL}/v1/news \\
  -H "Authorization: Bearer YOUR_PERSONAL_API_KEY"`}</code></pre>
          </div>
        </div>

        <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm sm:p-7">
          {loading && <p className="text-sm text-secondary" role="status">Memuat katalog API...</p>}
          {error && !loading && (
            <div role="alert">
              <p className="font-semibold text-[#9F1239]">Katalog API belum dapat dimuat.</p>
              <p className="mt-1 text-sm text-secondary">Buka dokumentasi publik atau coba lagi.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={reload} className="min-h-11 rounded-lg border border-[#BE123C] px-4 py-2 text-sm font-semibold text-[#9F1239] hover:bg-[#FFF7F7]">Coba lagi</button>
                <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-white hover:bg-[#3B5A70]">Buka dokumentasi</a>
              </div>
            </div>
          )}
          {!loading && !error && categories.length === 0 && <p className="text-sm text-secondary">Kategori endpoint belum tersedia.</p>}
          {!loading && !error && categories.length > 0 && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stroke pb-4">
                <div>
                  <p className="font-display text-xl font-semibold text-foreground">{info?.title ?? "UBSI API"}</p>
                  <p className="mt-1 text-sm text-secondary">Katalog publik {info?.version ? `v${info.version}` : "endpoint"}</p>
                </div>
                <code className="max-w-full break-all text-right font-mono text-xs text-[#075985]">{info?.base_url ?? API_DOCS_URL.replace("/v1/docs", "")}</code>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {categories.map(([key, endpoints]) => (
                  <div key={key} className="rounded-lg border border-stroke bg-[#F7FAFC] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{categoryLabels[key] ?? key}</span>
                      <span className="font-mono text-xs text-secondary">{endpoints.length} endpoint</span>
                    </div>
                    <p className="mt-2 truncate font-mono text-[11px] text-[#075985]">{endpoints[0]?.method} {endpoints[0]?.path}</p>
                  </div>
                ))}
              </div>
              <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[#0369A1] px-5 py-3 text-sm font-semibold text-white hover:bg-[#075985]">Lihat katalog lengkap</a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
