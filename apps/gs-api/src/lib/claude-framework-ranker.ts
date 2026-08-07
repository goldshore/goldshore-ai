import type { FrameworkMetadata } from './github-framework-search';

interface FrameworkScore {
  name: string;
  repo: string;
  securityScore: number;
  cloudflareScore: number;
  maintenanceScore: number;
  documentationScore: number;
  overallScore: number;
  reasoning: string;
}

/**
 * Use Claude API to score and rank frameworks based on:
 * - Security practices (dependency audits, vulnerability history)
 * - Cloudflare compatibility (wrangler config, bindings, edge runtime)
 * - Maintenance status (recent updates, active contributors)
 * - Documentation quality (README, examples, API docs)
 */
export async function rankFrameworksWithClaude(
  frameworks: FrameworkMetadata[],
  claudeApiKey: string,
  query: string
): Promise<FrameworkScore[]> {
  if (frameworks.length === 0) {
    return [];
  }

  const frameworkSummaries = frameworks
    .map(
      (f) => `
Framework: ${f.name}
Repository: ${f.repo}
Stars: ${f.stars}
Language: ${f.language}
Last Updated: ${f.lastUpdated}
Has wrangler.toml: ${f.hasWranglerConfig}
Description: ${f.description}
Package: ${f.packageJson ? JSON.stringify(f.packageJson).substring(0, 200) : 'N/A'}
`
    )
    .join('\n---\n');

  const prompt = `You are an expert in Cloudflare Workers and framework security evaluation.

Analyze these frameworks for the query: "${query}"

${frameworkSummaries}

For each framework, provide a JSON response with these scores (0-10):
- securityScore: Vulnerability history, dependency quality, security practices
- cloudflareScore: wrangler.toml presence, binding compatibility, edge runtime support
- maintenanceScore: Recent updates, active contributors, release frequency
- documentationScore: README quality, examples, type definitions, API documentation
- overallScore: Weighted average considering user's query relevance
- reasoning: 1-2 sentence explanation of the ranking

Return a JSON array of objects with keys: name, repo, securityScore, cloudflareScore, maintenanceScore, documentationScore, overallScore, reasoning`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.statusText} - ${error}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const text = data.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Could not parse Claude response as JSON');
  }

  const scores = JSON.parse(jsonMatch[0]) as FrameworkScore[];
  return scores.sort((a, b) => b.overallScore - a.overallScore);
}

export type { FrameworkScore };
