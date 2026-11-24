import { ArrowUpRight, BookOpen, Bug } from "lucide-react";
import type { RepositoryContributor } from "@/lib/github";

const CONTRIBUTING_URL = "https://github.com/MuaraAI/Mira/blob/main/CONTRIBUTING.md";
const NEW_ISSUE_URL = "https://github.com/MuaraAI/Mira/issues/new/choose";

function formatCommits(count: number): string {
  const formatted = new Intl.NumberFormat("id-ID").format(count);
  return `${formatted} ${count === 1 ? "commit" : "commits"}`;
}

function avatarSrc(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}s=96`;
}

export function ContributorsSection({ contributors }: { contributors: RepositoryContributor[] }) {
  return (
    <section id="kontributor" className="border-t-2 border-px-soft bg-background scroll-mt-28" aria-labelledby="contributors-title">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#0369A1]">
              Kontributor
            </p>
            <h2
              id="contributors-title"
              className="mt-2 font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl"
            >
              Dibangun bersama di Mira.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary sm:text-base">
              Setiap anggota yang menyumbangkan kode di repositori Mira, diurutkan berdasarkan jumlah commit. Terima kasih untuk setiap commit.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <a
              href={CONTRIBUTING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-btn-ghost inline-flex min-h-11 items-center gap-2 px-4 py-2.5 text-xs font-semibold sm:text-sm"
            >
              <BookOpen className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
              <span>Panduan kontribusi</span>
            </a>
            <a
              href={NEW_ISSUE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-btn-ghost inline-flex min-h-11 items-center gap-2 px-4 py-2.5 text-xs font-semibold sm:text-sm"
            >
              <Bug className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
              <span>Laporkan bug atau ide</span>
            </a>
          </div>
        </div>

        {contributors.length > 0 && (
          <ul className="mt-8 grid grid-cols-1 gap-4 p-[2px] min-[420px]:grid-cols-2 sm:grid-cols-3">
            {contributors.map((contributor) => (
              <li key={contributor.login} className="min-w-0">
                <a
                  href={contributor.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-card group flex min-w-0 items-center gap-3.5 bg-white p-4 transition-transform duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5"
                >
                  <img
                    src={avatarSrc(contributor.avatarUrl)}
                    alt={`Avatar GitHub ${contributor.login}`}
                    width={44}
                    height={44}
                    loading="lazy"
                    decoding="async"
                    className="h-11 w-11 shrink-0 border-2 border-px-soft bg-surface-alt object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-sm font-bold text-foreground group-hover:text-[#0369A1]">
                        {contributor.login}
                      </span>
                      <ArrowUpRight
                        className="h-3.5 w-3.5 shrink-0 text-secondary opacity-60 transition-opacity group-hover:text-[#0369A1] group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-secondary tabular-nums">
                      {formatCommits(contributor.contributions)}
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 font-mono text-xs leading-relaxed text-secondary">
          Kontribusi kode khusus Anggota Muara AI (mahasiswa aktif UBSI) lewat branch baru dan Pull Request.
        </p>
      </div>
    </section>
  );
}
