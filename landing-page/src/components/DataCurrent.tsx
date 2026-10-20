const flowNodes = [
  { label: "Mahasiswa", detail: "Akses akademik" },
  { label: "UBSI API", detail: "Satu interface" },
  { label: "SIAKAD + MyBest", detail: "Data kampus" },
  { label: "Dashboard / MCP", detail: "Tempat data dipakai" },
];

export function DataCurrent() {
  return (
    <section className="current-surface p-5 sm:p-7" aria-labelledby="data-current-title">
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker mb-2">Jalur layanan</p>
          <h2 id="data-current-title" className="font-display text-xl font-semibold text-foreground">
            Data mengalir ke tempat yang kamu butuhkan.
          </h2>
        </div>
        <span className="rounded-full bg-[#E4F1F8] px-2.5 py-1 text-[11px] font-mono font-semibold text-[#075985]">
          Public surface
        </span>
      </div>

      <p className="sr-only">
        Mahasiswa menggunakan UBSI API untuk mengakses data dari SIAKAD dan MyBest. Data tersedia di dashboard mahasiswa atau melalui MCP untuk integrasi yang sudah diautentikasi.
      </p>

      <div className="relative z-10 mt-7 space-y-3" aria-hidden="true">
        {flowNodes.map((node, index) => (
          <div key={node.label}>
            <div className="current-node">
              <span className="current-node-dot" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{node.label}</span>
                <span className="block truncate text-xs text-secondary">{node.detail}</span>
              </span>
            </div>
            {index < flowNodes.length - 1 && <div className="current-connector ml-5 w-[calc(100%-20px)]" />}
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-6 flex items-center justify-between border-t border-stroke pt-4 text-xs text-secondary">
        <span>REST API</span>
        <span className="text-[#0369A1]">MCP tersedia</span>
      </div>
    </section>
  );
}
