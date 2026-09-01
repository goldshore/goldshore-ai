import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { requireRbacPermission } from '../../middleware/requireRbacPermission';
import { errorHandler } from './middleware/auth';

const social = new Hono<{ Bindings: Env; Variables: Variables }>();

social.get('/drafts', await requireRbacPermission('perm_audit_view'), errorHandler(async (c) => {
  const limit = Math.min(Number(c.req.query('limit') || 50), 100);
  const rows = await c.env.PLATFORM_DB.prepare(
    'SELECT id, object_id, account_id, body, media_json, status, created_by, approved_by, created_at, updated_at FROM social_drafts ORDER BY created_at DESC LIMIT ?'
  ).bind(limit).all();
  return c.json({ drafts: rows.results ?? [] });
}));

social.post('/drafts', await requireRbacPermission('perm_workers_update'), errorHandler(async (c) => {
  const body = await c.req.json<{ objectId?: string; accountId?: string; text?: string; media?: string[]; idempotencyKey?: string }>();
  const text = body.text?.trim();
  const accountId = body.accountId?.trim();
  const key = body.idempotencyKey?.trim() || crypto.randomUUID();
  if (!text || text.length > 5000 || !accountId) return c.json({ error: 'accountId and text are required.' }, 400);
  const account = await c.env.PLATFORM_DB.prepare('SELECT id FROM social_accounts WHERE id = ? AND status = ?').bind(accountId, 'connected').first();
  if (!account) return c.json({ error: 'Social account is not connected.' }, 409);
  const id = `sd_${crypto.randomUUID()}`;
  try {
    await c.env.PLATFORM_DB.batch([
      c.env.PLATFORM_DB.prepare('INSERT INTO social_drafts (id, object_id, account_id, body, media_json, status, idempotency_key, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, body.objectId?.trim() || null, accountId, text, JSON.stringify(body.media ?? []), 'pending_approval', key, c.get('user')?.email ?? null),
      c.env.PLATFORM_DB.prepare('INSERT INTO approval_requests (id, resource_type, resource_id, requested_by) VALUES (?, ?, ?, ?)').bind(`apr_${crypto.randomUUID()}`, 'social_draft', id, c.get('user')?.email ?? null),
    ]);
  } catch (error) {
    if (String(error).includes('UNIQUE')) return c.json({ error: 'A draft with this idempotency key already exists.' }, 409);
    throw error;
  }
  return c.json({ id, status: 'pending_approval', approvalRequired: true }, 202);
}));

export default social;
