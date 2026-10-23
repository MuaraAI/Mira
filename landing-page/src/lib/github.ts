const REPOSITORY_URL = "https://api.github.com/repos/MuaraAI/Mira";

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
