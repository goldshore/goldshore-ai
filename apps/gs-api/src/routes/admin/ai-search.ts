import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { requireRbacPermission } from '../../middleware/requireRbacPermission';
import { errorHandler } from './middleware/auth';
import { searchGoldshoreKnowledge } from '../../lib/goldshore-knowledge';

const aiSearch = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * POST /api/admin/ai-search
 * Search using AI across all admin data
 */
aiSearch.post(
  '/',
  await requireRbacPermission('perm_audit_view'),
  errorHandler(async (c) => {
    const body = await c.req.json<{ query?: string }>();
    const query = body.query?.trim();

    if (!query || query.length > 500) return c.json({ error: 'Query must be between 1 and 500 characters.' }, 400);
    const matches = await searchGoldshoreKnowledge(c.env, query);

    return c.json({
      query,
      results: matches.map((match) => ({ title: match.title, text: match.text, score: match.score, source: match.source ?? null })),
      resultCount: matches.length,
    });
  })
);

export default aiSearch;
