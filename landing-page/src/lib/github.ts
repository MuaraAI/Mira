const REPOSITORY_URL = "https://api.github.com/repos/MuaraAI/Mira";
const CONTRIBUTORS_URL = `${REPOSITORY_URL}/contributors?per_page=30`;

export interface RepositoryContributor {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

export async function getRepositoryStars(): Promise<number | null> {
  try {
    const response = await fetch(REPOSITORY_URL, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { stargazers_count?: unknown };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

export async function getRepositoryContributors(): Promise<RepositoryContributor[]> {
  try {
    const response = await fetch(CONTRIBUTORS_URL, {
      headers: { Accept: "application/vnd.github+json" },
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
