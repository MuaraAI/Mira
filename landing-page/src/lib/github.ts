const REPOSITORY_URL = "https://api.github.com/repos/MuaraAI/Mira";
const CONTRIBUTORS_URL = `${REPOSITORY_URL}/contributors?per_page=30`;

export interface RepositoryContributor {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

export interface RepositoryStats {
  stars: number;
  forks: number;
  contributors: number | null;
  pushedAt: string | null;
}

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "mira-web",
};

export async function getRepositoryStats(): Promise<RepositoryStats | null> {
  try {
    const [repoRes, contributorsRes] = await Promise.all([
      fetch(REPOSITORY_URL, { headers: GITHUB_HEADERS, next: { revalidate: 900 } }),
      fetch(`${REPOSITORY_URL}/contributors?per_page=100`, {
        headers: GITHUB_HEADERS,
        next: { revalidate: 900 },
      }).catch(() => null),
    ]);

    if (!repoRes.ok) return null;
    const repo = (await repoRes.json()) as {
      stargazers_count?: unknown;
      forks_count?: unknown;
      pushed_at?: unknown;
    };
    if (typeof repo.stargazers_count !== "number") return null;

    let contributors: number | null = null;
    if (contributorsRes?.ok) {
      const list = (await contributorsRes.json()) as unknown;
      if (Array.isArray(list)) contributors = list.length;
    }

    return {
      stars: repo.stargazers_count,
      forks: typeof repo.forks_count === "number" ? repo.forks_count : 0,
      contributors,
      pushedAt: typeof repo.pushed_at === "string" ? repo.pushed_at : null,
    };
  } catch {
    return null;
  }
}

export async function getRepositoryContributors(): Promise<RepositoryContributor[]> {
  try {
    const response = await fetch(CONTRIBUTORS_URL, {
      headers: GITHUB_HEADERS,
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) return [];

    return data
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .filter((item) => item.type === "User")
      .map((item) => ({
        login: typeof item.login === "string" ? item.login : "",
        avatarUrl: typeof item.avatar_url === "string" ? item.avatar_url : "",
        profileUrl: typeof item.html_url === "string" ? item.html_url : "",
        contributions: typeof item.contributions === "number" ? item.contributions : 0,
      }))
      .filter((c) => c.login && c.avatarUrl && c.profileUrl && c.contributions > 0)
      .sort((a, b) => b.contributions - a.contributions);
  } catch {
    return [];
  }
}

export async function getRepositoryStars(): Promise<number | null> {
  const stats = await getRepositoryStats();
  return stats?.stars ?? null;
}
