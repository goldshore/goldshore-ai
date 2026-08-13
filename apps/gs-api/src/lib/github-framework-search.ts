interface GitHubRepo {
  name: string;
  full_name: string;
  description: string;
  url: string;
  stars: number;
  language: string;
  updated_at: string;
  topics: string[];
}

interface FrameworkMetadata {
  name: string;
  repo: string;
  description: string;
  url: string;
  stars: number;
  language: string;
  lastUpdated: string;
  hasWranglerConfig: boolean;
  packageJson?: Record<string, unknown>;
  wranglerToml?: Record<string, unknown>;
}

/**
 * Search GitHub for Cloudflare Worker frameworks matching a query.
 * Prioritizes repos with:
 * - Cloudflare Worker keywords/topics
 * - wrangler.toml configuration
 * - Active maintenance (recent updates)
 * - TypeScript/JavaScript
 */
export async function searchGitHubFrameworks(
  query: string,
  token: string
): Promise<FrameworkMetadata[]> {
  const searchQuery = `${query} cloudflare workers wrangler language:javascript OR language:typescript stars:>10 is:public sort:stars-desc`;

  const response = await fetch('https://api.github.com/search/repositories', {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const data = (await response.json()) as { items: GitHubRepo[] };
  const frameworks: FrameworkMetadata[] = [];

  for (const repo of data.items.slice(0, 10)) {
    try {
      const metadata = await fetchRepoMetadata(repo, token);
      frameworks.push(metadata);
    } catch (error) {
      console.error(`Failed to fetch metadata for ${repo.full_name}:`, error);
    }
  }

  return frameworks;
}

async function fetchRepoMetadata(
  repo: GitHubRepo,
  token: string
): Promise<FrameworkMetadata> {
  const [packageJson, wranglerToml] = await Promise.allSettled([
    fetchFileContent(repo.full_name, 'package.json', token),
    fetchFileContent(repo.full_name, 'wrangler.toml', token),
  ]);

  return {
    name: repo.name,
    repo: repo.full_name,
    description: repo.description || 'No description',
    url: repo.url,
    stars: repo.stars,
    language: repo.language || 'Unknown',
    lastUpdated: repo.updated_at,
    hasWranglerConfig: wranglerToml.status === 'fulfilled' && wranglerToml.value !== null,
    packageJson: packageJson.status === 'fulfilled' ? (packageJson.value as Record<string, unknown> | undefined) : undefined,
    wranglerToml: wranglerToml.status === 'fulfilled' ? (wranglerToml.value as Record<string, unknown> | undefined) : undefined,
  };
}

async function fetchFileContent(
  repo: string,
  path: string,
  token: string
): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
        Authorization: `token ${token}`,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const content = await response.text();

  if (path.endsWith('.json')) {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (path.endsWith('.toml')) {
    return { raw: content };
  }

  return null;
}

export type { FrameworkMetadata, GitHubRepo };
