import { API_BASE_URL, API_DOCS_URL, GITHUB_URL, MCP_URL } from "@/lib/public-links";

/** Bagian ringkas untuk developer: REST API dan server MCP. */
export function DeveloperSection() {
  return (
    <section id="developer" className="border-b-2 border-px-soft bg-white" aria-labelledby="developer-title">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="min-w-0">
          <h2 id="developer-title" className="font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
            Mau bikin bot atau sambungin AI?
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-secondary">
            Ada REST API dan server MCP, jadi data kuliahmu bisa dipakai di bot Discord, skrip sendiri, atau AI agent seperti Claude, ChatGPT, dan Cursor. Cukup buat Personal API Key di dashboard.
          </p>
          <div className="mt-7 flex flex-wrap gap-4">
            <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="px-btn inline-flex min-h-11 items-center gap-2 px-5 py-3 text-sm font-bold">
              Buka API Docs
              <span aria-hidden="true">→</span>
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="px-btn-ghost inline-flex min-h-11 items-center px-5 py-3 text-sm font-semibold">
              Lihat di GitHub
            </a>
          </div>
        </div>

        <div id="mcp" className="min-w-0 scroll-mt-28 self-center">
          <div className="bg-[#131B26] shadow-[0_-2px_0_0_#0B2D46,0_2px_0_0_#0B2D46,-2px_0_0_0_#0B2D46,2px_0_0_0_#0B2D46,4px_4px_0_0_#0369A1]">
            <div className="flex items-center gap-1.5 border-b-2 border-[#0B2D46] px-3 py-2" aria-hidden="true">
              <span className="h-2 w-2 bg-[#BE123C]" />
              <span className="h-2 w-2 bg-px-sun" />
              <span className="h-2 w-2 bg-[#0F766E]" />
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 text-[#CFE8F5]"><code>{`# REST API
curl ${API_BASE_URL}/v1/studentv2/schedule \\
  -H "Authorization: Bearer YOUR_PERSONAL_API_KEY"

# MCP server
${MCP_URL}`}</code></pre>
          </div>
        </div>
      </div>
    </section>
  );
}
