import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const account = new Hono<{ Bindings: Env; Variables: Variables }>();

const subject = (c: { get: (key: 'accessClaims') => { sub?: string; email?: string } | null }) => {
  const claims = c.get('accessClaims');
  return claims?.sub ?? claims?.email ?? null;
};

const resolveUserId = async (c: { env: Env; get: (key: 'accessClaims') => { sub?: string; email?: string } | null }) => {
  const claims = c.get('accessClaims');
  const identity = claims?.sub ?? claims?.email;
  if (!identity) return null;
  return c.env.PLATFORM_DB.prepare(
    'SELECT id FROM users WHERE (id = ? OR email = ?) AND deleted_at IS NULL LIMIT 1',
  ).bind(identity, claims?.email ?? identity).first<{ id: string }>();
};

account.get('/me', async (c) => {
  const id = subject(c);
  if (!id) return c.json({ error: 'Unauthorized' }, 401);
  const user = await c.env.PLATFORM_DB.prepare(
    `SELECT id, email, display_name, status, created_at FROM users
      WHERE (id = ? OR email = ?) AND deleted_at IS NULL LIMIT 1`,
  ).bind(id, id).first();
  if (!user) return c.json({ error: 'Account not provisioned' }, 404);
  return c.json(user);
});

account.get('/consents', async (c) => {
  const user = await resolveUserId(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const result = await c.env.PLATFORM_DB.prepare(
    'SELECT purpose, granted, recorded_at, withdrawn_at FROM account_consents WHERE user_id = ? ORDER BY purpose',
  ).bind(user.id).all();
  return c.json({ items: result.results ?? [] });
});

account.put('/consents/:purpose', async (c) => {
  const user = await resolveUserId(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const purpose = c.req.param('purpose');
  if (!['product_analytics', 'advertising', 'marketing'].includes(purpose)) return c.json({ error: 'Unsupported consent purpose' }, 400);
  const body = await c.req.json<{ granted?: boolean }>().catch(() => null);
  if (typeof body?.granted !== 'boolean') return c.json({ error: 'granted must be boolean' }, 400);
  await c.env.PLATFORM_DB.prepare(
    `INSERT INTO account_consents(id,user_id,purpose,granted,recorded_at,withdrawn_at)
     VALUES(?,?,?,?,datetime('now'),CASE WHEN ? THEN NULL ELSE datetime('now') END)
     ON CONFLICT(user_id,purpose) DO UPDATE SET granted=excluded.granted,recorded_at=excluded.recorded_at,withdrawn_at=excluded.withdrawn_at`,
  ).bind(crypto.randomUUID(), user.id, purpose, body.granted ? 1 : 0, body.granted ? 1 : 0).run();
  return c.json({ purpose, granted: body.granted });
});

account.post('/requests/:kind', async (c) => {
  const user = await resolveUserId(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const kind = c.req.param('kind');
  if (kind !== 'export' && kind !== 'deletion') return c.json({ error: 'Unsupported request' }, 400);
  const requestId = crypto.randomUUID();
  await c.env.PLATFORM_DB.prepare('INSERT INTO account_requests(id,user_id,kind) VALUES(?,?,?)').bind(requestId, user.id, kind).run();
  return c.json({ id: requestId, kind, status: 'pending' }, 202);
});

account.all('/phone/*', (c) => c.json({ error: 'Phone verification is not provisioned.' }, 503));

export default account;
