import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { requireRbacPermission } from '../../middleware/requireRbacPermission';
import { errorHandler } from './middleware/auth';

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
    const db = c.env.PLATFORM_DB;
    const ai = c.env.AI;
    const body = (await c.req.json()) as any;
    const query = body.query;

    if (!query) {
      return c.json({ error: 'Query required' }, 400);
    }

    const roles = await db.prepare('SELECT * FROM admin_roles LIMIT 50').all();
    const users = await db.prepare('SELECT id, email, name, role_id, status FROM admin_users LIMIT 50').all();
    const logs = await db.prepare('SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 20').all();

    const context = `
Admin Data:
Roles: ${JSON.stringify(roles.results || [])}
Users: ${JSON.stringify(users.results || [])}
Recent Audit Logs: ${JSON.stringify(logs.results || [])}

User Query: ${query}
`;

    const response = await ai.run('@cf/mistral/mistral-7b-instruct-v0.1', {
      prompt: context,
      max_tokens: 500,
    });

    return c.json({
      query,
      result: (response as any).result?.response || '',
      context_size: (roles.results?.length || 0) + (users.results?.length || 0) + (logs.results?.length || 0),
    });
  })
);

export default aiSearch;
