import { LLMClient } from './llm-abstraction';
import type { Env } from '../types';

export type AssistantDeploymentModel = 'workers' | 'pages';

export type AssistantTemplate = {
  id: string;
  name: string;
  summary: string;
  deploymentModel: AssistantDeploymentModel;
  cloudflareNative: boolean;
  securityVetted: boolean;
  repository?: string;
  docsUrl?: string;
  tags: string[];
  score: number;
  source: 'catalog' | 'github';
};

export type AssistantFilters = {
  cloudflareNativeOnly?: boolean;
  securityOnly?: boolean;
};

export type AssistantDryRunPlan = {
  templateId: string;
  templateName: string;
  command: string;
  workspace: string;
  deploymentModel: AssistantDeploymentModel;
  checklist: string[];
};

export type AssistantPullRequestDraft = {
  repository: string;
  head: string;
  base: string;
  title: string;
  body: string;
};

export const getGitHubToken = (env: Env) =>
  env.GITHUB_TOKEN || env.GITHUB_API_TOKEN || env.GH_TOKEN || null;

const CATALOG: Omit<AssistantTemplate, 'score' | 'source'>[] = [
  {
    id: 'astro-pages-functions-admin',
    name: 'Astro Pages Functions Admin Shell',
    summary: 'Astro Pages Functions shell for authenticated admin workspaces with Cloudflare Access and server-side routing.',
    deploymentModel: 'pages',
    cloudflareNative: true,
    securityVetted: true,
    repository: 'withastro/astro',
    docsUrl: 'https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/',
    tags: ['astro', 'pages', 'functions', 'admin', 'access', 'cloudflare-native'],
  },
  {
    id: 'hono-workers-control-plane',
    name: 'Hono Workers Control Plane',
    summary: 'Lightweight Hono Worker patterns for admin APIs, streaming endpoints, and edge-authenticated operations.',
    deploymentModel: 'workers',
    cloudflareNative: true,
    securityVetted: true,
    repository: 'honojs/hono',
    docsUrl: 'https://hono.dev/docs/getting-started/cloudflare-workers',
    tags: ['hono', 'workers', 'api', 'streaming', 'cloudflare-native'],
  },
  {
    id: 'react-router-worker-dashboard',
    name: 'React Router on Workers Dashboard',
    summary: 'Cloudflare-native dashboard starter with React Router, strict auth boundaries, and worker-side data fetches.',
    deploymentModel: 'workers',
    cloudflareNative: true,
    securityVetted: true,
    repository: 'remix-run/react-router',
    docsUrl: 'https://developers.cloudflare.com/workers/framework-guides/web-apps/',
    tags: ['react-router', 'workers', 'dashboard', 'auth', 'cloudflare-native'],
  },
  {
    id: 'next-on-pages-control-room',
    name: 'Next.js on Pages Control Room',
    summary: 'Next.js deployment pattern for operator dashboards that need Cloudflare Pages previews and tight access policy.',
    deploymentModel: 'pages',
    cloudflareNative: true,
    securityVetted: true,
    repository: 'cloudflare/next-on-pages',
    docsUrl: 'https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/',
    tags: ['nextjs', 'pages', 'preview', 'cloudflare-native'],
  },
  {
    id: 'sveltekit-cloudflare-admin',
    name: 'SvelteKit Cloudflare Admin',
    summary: 'SvelteKit starter configured for Cloudflare with secure form handling and edge rendering.',
    deploymentModel: 'workers',
    cloudflareNative: true,
    securityVetted: true,
    repository: 'sveltejs/kit',
    docsUrl: 'https://developers.cloudflare.com/pages/framework-guides/deploy-a-sveltekit-site/',
    tags: ['sveltekit', 'workers', 'admin', 'edge', 'cloudflare-native'],
  },
  {
    id: 'worker-assets-cms-shell',
    name: 'Worker Assets CMS Shell',
    summary: 'Workers + Assets pattern for controlled content publishing, media delivery, and operational dashboards.',
    deploymentModel: 'workers',
    cloudflareNative: true,
    securityVetted: true,
    tags: ['workers-assets', 'cms', 'assets', 'publish'],
  },
  {
    id: 'generic-jamstack',
    name: 'Generic Jamstack Starter',
    summary: 'Not Cloudflare-specific enough for the assistant default shortlist.',
    deploymentModel: 'pages',
    cloudflareNative: false,
    securityVetted: false,
    tags: ['jamstack'],
  },
];

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean);

const uniqueById = (items: AssistantTemplate[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const scoreTemplate = (template: Omit<AssistantTemplate, 'score' | 'source'>, tokens: string[]) => {
  const haystack = [
    template.id,
    template.name,
    template.summary,
    template.repository ?? '',
    template.docsUrl ?? '',
    ...template.tags,
  ].join(' ').toLowerCase();

  const tokenScore = tokens.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0);
  const cloudflareBonus = template.cloudflareNative ? 4 : 0;
  const securityBonus = template.securityVetted ? 3 : 0;
  const deploymentBonus =
    tokens.includes(template.deploymentModel) || haystack.includes(template.deploymentModel)
      ? 2
      : 0;

  return tokenScore + cloudflareBonus + securityBonus + deploymentBonus;
};

const catalogMatches = (query: string, filters: AssistantFilters) => {
  const tokens = tokenize(query);

  return CATALOG.map((template) => ({
    ...template,
    score: scoreTemplate(template, tokens),
    source: 'catalog' as const,
  }))
    .filter((template) => (filters.cloudflareNativeOnly === false ? true : template.cloudflareNative))
    .filter((template) => (filters.securityOnly === false ? true : template.securityVetted))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
};

const buildGitHubQuery = (query: string) => {
  const tokens = tokenize(query);
  const base = ['cloudflare', 'pages', 'workers', 'astro', 'hono'];
  const queryParts = [...base, ...tokens].filter(Boolean);
  return queryParts.join(' ');
};

const fetchGitHubTemplates = async (env: Env, query: string, filters: AssistantFilters) => {
  const token = getGitHubToken(env);
  if (!token) {
    return [];
  }

  const response = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(buildGitHubQuery(query))}&sort=stars&order=desc&per_page=5`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!response.ok) {
    return [];
  }

  const payload = await response.json() as {
    items?: Array<{
      full_name: string;
      description?: string | null;
      html_url: string;
      topics?: string[];
      language?: string | null;
    }>;
  };

  return (payload.items ?? [])
    .map((item) => ({
      id: `github:${item.full_name}`,
      name: item.full_name,
      summary: item.description?.trim() || 'GitHub repository matched the assistant query.',
      deploymentModel: item.topics?.some((topic) => topic.includes('pages')) ? 'pages' : 'workers',
      cloudflareNative: (item.topics ?? []).some((topic) => /cloudflare|pages|workers|wrangler/i.test(topic)) ||
        /cloudflare|pages|workers|wrangler/i.test(item.description ?? '') ||
        /cloudflare|pages|workers|wrangler/i.test(item.full_name),
      securityVetted: true,
      repository: item.full_name,
      docsUrl: item.html_url,
      tags: [...(item.topics ?? []), item.language ?? ''].filter(Boolean),
      score: 0,
      source: 'github' as const,
    }))
    .filter((template) => (filters.cloudflareNativeOnly === false ? true : template.cloudflareNative))
    .filter((template) => (filters.securityOnly === false ? true : template.securityVetted));
};

const summarizeWithClaude = async (env: Env, query: string, recommendations: AssistantTemplate[]) => {
  if (!env.ANTHROPIC_API_KEY) {
    return buildOfflineSummary(query, recommendations);
  }

  try {
    const client = new LLMClient({
      provider: 'claude',
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.LLM_MODEL || 'claude-sonnet-4-5',
      temperature: 0.2,
      maxTokens: 400,
      env,
    });

    const response = await client.complete({
      messages: [
        {
          role: 'system',
          content: [
            'You rank Cloudflare-native frameworks and templates for a secure admin deployment assistant.',
            'Keep the output concise, practical, and focused on Cloudflare Pages, Workers, auth, and deployment safety.',
            'Do not recommend anything that lacks Cloudflare compatibility or security posture.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({ query, recommendations }, null, 2),
        },
      ],
      maxTokens: 400,
      temperature: 0.2,
    });

    return response.content.trim() || buildOfflineSummary(query, recommendations);
  } catch {
    return buildOfflineSummary(query, recommendations);
  }
};

const buildOfflineSummary = (query: string, recommendations: AssistantTemplate[]) => {
  const top = recommendations.slice(0, 3).map((item) => item.name).join(', ');
  return `Top Cloudflare-safe matches for "${query || 'admin deployment'}": ${top || 'none found'}.`;
};

export const searchAssistantTemplates = async (
  env: Env,
  query: string,
  filters: AssistantFilters = {},
) => {
  const catalog = catalogMatches(query, filters);
  const github = await fetchGitHubTemplates(env, query, filters);
  const rankedGithub = github.map((item) => ({
    ...item,
    score: item.score + (item.cloudflareNative ? 4 : 0) + (item.securityVetted ? 2 : 0),
  })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const recommendations = uniqueById([...rankedGithub, ...catalog]).slice(0, 8);
  const summary = await summarizeWithClaude(env, query, recommendations);

  return {
    query,
    summary,
    recommendations,
    counts: {
      catalog: catalog.length,
      github: rankedGithub.length,
      filtered: recommendations.length,
    },
  };
};

export const getAssistantTemplate = (templateId: string) => {
  return CATALOG.find((template) => template.id === templateId) ?? null;
};

export const createDryRunPlan = (template: Omit<AssistantTemplate, 'score' | 'source'>, workspace = 'apps/gs-web') => {
  const command =
    template.deploymentModel === 'pages'
      ? `pnpm wrangler setup --dry-run --cwd ${workspace}`
      : `pnpm wrangler deploy --dry-run --cwd ${workspace}`;

  return {
    templateId: template.id,
    templateName: template.name,
    command,
    workspace,
    deploymentModel: template.deploymentModel,
    checklist: [
      'Confirm the target route lives under apps/gs-web.',
      'Review security-vetted Cloudflare-native dependencies only.',
      'Verify the dry-run output before preparing the PR.',
      'Open a reviewed PR before any live deployment attempt.',
    ],
  } satisfies AssistantDryRunPlan;
};

export const buildPullRequestDraft = (
  template: Omit<AssistantTemplate, 'score' | 'source'>,
  options: {
    repository: string;
    head: string;
    base: string;
    query: string;
    dryRunCommand: string;
  },
) : AssistantPullRequestDraft => {
  return {
    repository: options.repository,
    head: options.head,
    base: options.base,
    title: `Add ${template.name} for ${options.query || 'admin deployment assistant'}`,
    body: [
      '### Summary',
      `- Template: ${template.name}`,
      `- Deployment model: ${template.deploymentModel}`,
      `- Dry run: ${options.dryRunCommand}`,
      '',
      '### Safety gates',
      '- Cloudflare-native only',
      '- Security-vetted shortlist only',
      '- Manual review required before merge',
    ].join('\n'),
  };
};
