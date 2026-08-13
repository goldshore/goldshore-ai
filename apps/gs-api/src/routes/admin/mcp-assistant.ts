import { Hono } from 'hono';
import { requirePermission } from '../../auth';
import { searchGoldshoreKnowledge } from '../../lib/goldshore-knowledge';
import type { Env, Variables } from '../../types';

const route = new Hono<{ Bindings: Env; Variables: Variables }>();

export const assistantAreas = [
  { id: 'infrastructure', title: 'Infrastructure', description: 'Workers, routes, bindings, storage, queues, DNS, Access, and deployment ownership.', prompts: ['Which app owns email handling?', 'Show the production gs-api bindings', 'How is admin access protected?'] },
  { id: 'integrations', title: 'API integrations', description: 'Provider prerequisites, OAuth state, webhooks, secret contracts, and safe validation.', prompts: ['How do I add a new API integration?', 'Which OAuth integrations are fail-closed?', 'Where should provider secrets live?'] },
  { id: 'email', title: 'Email', description: 'Cloudflare Email Service, routing, inbound handling, queues, templates, and delivery checks.', prompts: ['How does inbound email reach gs-api?', 'Which sender addresses are allowed?', 'How do I verify a mail deployment?'] },
  { id: 'ads', title: 'Ads', description: 'Google Ads, Meta Ads, AdSense, account configuration, reporting, and credential readiness.', prompts: ['What is required for Google Ads?', 'Where is Meta Ads configured?', 'Which ad tools are read-only?'] },
  { id: 'tools', title: 'Tool setup and use', description: 'MCP client connection, available tools, permissions, testing, and operator runbooks.', prompts: ['How do I connect this MCP server?', 'Which tools are currently available?', 'How should I test a new tool?'] },
] as const;

route.get('/catalog', requirePermission('system:read'), (c) => c.json({
  server: { name: 'goldshore-mcp', url: 'https://mcp.goldshore.ai/mcp', transport: 'streamable-http', access: 'Cloudflare Access' },
  knowledge: { provider: 'Cloudflare AI Search', instance: 'royal-wind-4649', status: 'configured; results depend on completed indexing' },
  areas: assistantAreas,
}));

route.post('/search', requirePermission('system:read'), async (c) => {
  let payload: { query?: string };
  try { payload = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON payload.' }, 400); }
  const query = payload.query?.trim();
  if (!query || query.length > 500) return c.json({ error: 'Query must be between 1 and 500 characters.' }, 400);
  try {
    const results = await searchGoldshoreKnowledge(c.env, query);
    return c.json({ query, results, indexed: results.length > 0 });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Knowledge search failed.' }, 502);
  }
});

export default route;

