import type { Env } from '../types';

export const DEFAULT_AI_SEARCH_ENDPOINT =
  'https://f800ea69-7ef4-4094-ba29-de38736fd22f.search.ai.cloudflare.com';

export type KnowledgeResult = { title: string; text: string; score: number; source?: string };

export async function searchGoldshoreKnowledge(env: Env, query: string): Promise<KnowledgeResult[]> {
  const endpoint = (env.AI_SEARCH_PUBLIC_ENDPOINT || DEFAULT_AI_SEARCH_ENDPOINT).replace(/\/$/, '');
  const response = await fetch(`${endpoint}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, ai_search_options: { retrieval: { max_num_results: 8 } } }),
  });
  if (!response.ok) throw new Error(`AI Search returned HTTP ${response.status}.`);
  const payload = (await response.json()) as {
    success?: boolean;
    result?: { chunks?: Array<{ text?: string; score?: number; item?: { key?: string; metadata?: Record<string, unknown> } }> };
  };
  if (!payload.success) throw new Error('AI Search did not complete the query.');
  return (payload.result?.chunks ?? []).map((chunk) => ({
    title: String(chunk.item?.metadata?.title ?? chunk.item?.key ?? 'GoldShore knowledge'),
    text: chunk.text ?? '',
    score: chunk.score ?? 0,
    source: typeof chunk.item?.metadata?.url === 'string' ? chunk.item.metadata.url : chunk.item?.key,
  }));
}

