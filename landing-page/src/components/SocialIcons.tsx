import { INSTAGRAM_URL, THREADS_URL, X_URL } from "@/lib/public-links";

export function InstagramGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function XGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function ThreadsGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19.2 10.6c-.2-4.4-3-7.6-7.2-7.6-4.5 0-7.8 3.4-7.8 9s3.3 9 7.9 9c3.1 0 5.4-1.2 6.8-3.2" />
      <path d="M15.8 11.4c-.1-2.2-1.4-3.6-3.7-3.6-1.7 0-2.9.8-3.4 2" />
      <path d="M15.8 11.4c.1 2.7-1.1 4.6-3.4 4.6-1.6 0-2.8-.9-2.8-2.3 0-1.5 1.3-2.4 3.4-2.4 1.3 0 2.3.2 3.2.7 1.7.9 2.9 2.3 2.9 4.2" />
    </svg>
  );
}

export const SOCIAL_PROFILES = [
  {
    id: "instagram",
    name: "Instagram",
    handle: "@muara.ai",
    href: INSTAGRAM_URL,
    icon: InstagramGlyph,
  },
  {
    id: "x",
    name: "X",
    handle: "@MuaraAI",
    href: X_URL,
    icon: XGlyph,
  },
  {
    id: "threads",
    name: "Threads",
    handle: "@muara.ai",
    href: THREADS_URL,
    icon: ThreadsGlyph,
  },
] as const;
