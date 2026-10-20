const flowNodes = [
  { label: "Mahasiswa", detail: "Akses akademik" },
  { label: "UBSI API", detail: "Satu interface" },
  { label: "SIAKAD + MyBest", detail: "Data kampus" },
  { label: "Dashboard / MCP", detail: "Tempat data dipakai" },
];

/** Stepped pixel water strip along the bottom of the panel. */
function PixelWater() {
  return (
    <svg className="px-water block h-4 w-[calc(100%+8px)]" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
      <defs>
        <pattern id="data-current-water" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#FFFFFF" />
          <rect y="6" width="4" height="10" fill="#9CC6E0" />
          <rect x="4" y="4" width="4" height="12" fill="#9CC6E0" />
          <rect x="8" y="6" width="4" height="10" fill="#9CC6E0" />
          <rect x="12" y="8" width="4" height="8" fill="#9CC6E0" />
          <rect y="10" width="16" height="6" fill="#5FA3CC" />
          <rect y="13" width="16" height="3" fill="#0369A1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#data-current-water)" />
    </svg>
  );
}

export function DataCurrent() {
  return (
    <section className="current-surface group min-w-0" aria-labelledby="data-current-title">
      <div className="flex items-center gap-1.5 border-b-2 border-px-soft bg-px-tint px-4 py-2.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 bg-[#BE123C]" />
        <span className="h-2.5 w-2.5 bg-px-sun" />
        <span className="h-2.5 w-2.5 bg-[#0F766E]" />
      </div>

      <div className="p-5 sm:p-7">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-kicker mb-2">Jalur layanan</p>
            <h2 id="data-current-title" className="font-display text-xl font-semibold text-foreground">
              Data mengalir ke tempat yang kamu butuhkan.
            </h2>
          </div>
          <span className="px-chip bg-[#E4F1F8] px-2.5 py-1 text-[11px] font-mono font-semibold text-[#075985]">
            Public surface
          </span>
        </div>

        <p className="sr-only">
          Mahasiswa menggunakan UBSI API untuk mengakses data dari SIAKAD dan MyBest. Data tersedia di dashboard mahasiswa atau melalui MCP untuk integrasi yang sudah diautentikasi.
        </p>

        <ol className="relative z-10 mt-7" aria-hidden="true">
          {flowNodes.map((node, index) => (
            <li key={node.label}>
              <div className="current-node">
                <span className="current-node-dot" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{node.label}</span>
                  <span className="block truncate text-xs text-secondary">{node.detail}</span>
                </span>
                <span className="font-mono text-[10px] font-bold text-px-water-mid">{String(index + 1).padStart(2, "0")}</span>
              </div>
              {index < flowNodes.length - 1 && <div className="current-connector h-4" />}
            </li>
          ))}
        </ol>

        <div className="relative z-10 mt-6 flex items-center justify-between border-t-2 border-dashed border-px-soft pt-4 font-mono text-xs text-secondary">
          <span>REST API</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#0369A1]">
            <span className="h-1.5 w-1.5 bg-[#0F766E]" aria-hidden="true" />
            MCP tersedia
          </span>
        </div>
      </div>

      <div className="overflow-hidden">
        <PixelWater />
      </div>
    </section>
  );
}
