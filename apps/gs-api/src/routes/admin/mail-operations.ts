import { Hono } from 'hono';
import { isValidEmail } from '@goldshore/utils';
import { getActor, logAdminAction, requirePermission } from '../../auth';
import type { Env, Variables } from '../../types';

const mailOperations = new Hono<{ Bindings: Env; Variables: Variables }>();
const subscriberStatuses = new Set(['pending', 'confirmed', 'unsubscribed', 'suppressed', 'invalid']);
const listStatuses = new Set(['active', 'paused', 'archived']);
const mailboxStatuses = new Set(['draft', 'active', 'paused', 'archived']);
const listIdPattern = /^[a-z0-9][a-z0-9_-]{1,62}$/;
const pageArgs = (c: any) => { const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1); const pageSize = Math.min(100, Math.max(10, Number.parseInt(c.req.query('pageSize') ?? '25', 10) || 25)); return { page, pageSize, offset: (page - 1) * pageSize }; };
const audit = (c: any, action: string, metadata: Record<string, unknown>) => logAdminAction(c.env, { action, actor: getActor(c.get('accessClaims'), c.req.raw), status: 'success', metadata });
const digest = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
export const safeAudienceCsvCell = (value: unknown) => {
  const raw = String(value ?? '');
  const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
};
export const isManagedMailboxAddress = (value: unknown) => {
  if (typeof value !== 'string' || !isValidEmail(value)) return false;
  return ['goldshore.ai', 'goldshore.org'].includes(value.trim().toLowerCase().split('@')[1]);
};

mailOperations.get('/audiences/lists', requirePermission('email_subscribers:read'), async (c) => {
  const rows = await c.env.PLATFORM_DB.prepare(`SELECT l.id,l.name,l.brand,l.description,l.status,l.created_at,l.updated_at,
    COUNT(s.id) subscriber_count,SUM(CASE WHEN s.status='confirmed' THEN 1 ELSE 0 END) confirmed_count
    FROM email_lists l LEFT JOIN newsletter_subscribers s ON s.list_name=l.name AND s.brand=l.brand GROUP BY l.id ORDER BY l.updated_at DESC`).all();
  return c.json({ items: rows.results });
});

mailOperations.post('/audiences/lists', requirePermission('email_subscribers:create'), async (c) => {
  const body = await c.req.json<{ id?: string; name?: string; brand?: string; description?: string }>().catch(() => null); const id = body?.id?.trim().toLowerCase() ?? ''; const name = body?.name?.trim().toLowerCase() ?? ''; const brand = body?.brand?.trim().toLowerCase() || 'goldshore';
  if (!listIdPattern.test(id) || !listIdPattern.test(name) || !listIdPattern.test(brand) || (body?.description?.length ?? 0) > 500) return c.json({ error: 'Valid list ID, name, brand, and description are required.' }, 400);
  try { await c.env.PLATFORM_DB.prepare('INSERT INTO email_lists(id,name,brand,description,created_by) VALUES(?,?,?,?,?)').bind(id, name, brand, body?.description?.trim() ?? '', getActor(c.get('accessClaims'), c.req.raw)).run(); } catch { return c.json({ error: 'That email list already exists.' }, 409); }
  await audit(c, 'audience.list.create', { listId: id, name, brand }); return c.json({ id, name, brand, description: body?.description?.trim() ?? '', status: 'active' }, 201);
});

mailOperations.patch('/audiences/lists/:id', requirePermission('email_subscribers:update'), async (c) => {
  const body = await c.req.json<{ description?: string; status?: string }>().catch(() => null); if (!body || (body.status && !listStatuses.has(body.status)) || (body.description?.length ?? 0) > 500) return c.json({ error: 'Valid description and list status are required.' }, 400);
  const result = await c.env.PLATFORM_DB.prepare('UPDATE email_lists SET description=COALESCE(?,description),status=COALESCE(?,status),updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(body.description?.trim() ?? null, body.status ?? null, c.req.param('id')).run(); if (!result.meta.changes) return c.json({ error: 'Email list not found.' }, 404);
  await audit(c, 'audience.list.update', { listId: c.req.param('id'), status: body.status }); return c.json({ success: true });
});

mailOperations.get('/audiences/subscribers', requirePermission('email_subscribers:read'), async (c) => {
  const { page, pageSize, offset } = pageArgs(c); const where: string[] = []; const values: unknown[] = []; const status = c.req.query('status'); const list = c.req.query('list');
  if (status && subscriberStatuses.has(status)) { where.push('status=?'); values.push(status); } if (list && listIdPattern.test(list)) { where.push('list_name=?'); values.push(list); } const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const select = 'SELECT id,email,name,brand,list_name,source,status,consent_basis,subscribed_at,confirmed_at,unsubscribed_at,updated_at FROM newsletter_subscribers';
  if (c.req.query('format') === 'csv') { const rows = await c.env.PLATFORM_DB.prepare(`${select} ${filter} ORDER BY updated_at DESC LIMIT 10000`).bind(...values).all<any>(); const header = ['email','name','brand','list_name','status','source','consent_basis','subscribed_at','confirmed_at']; const csv = [header.join(','), ...rows.results.map((row) => header.map((key) => safeAudienceCsvCell(row[key])).join(','))].join('\r\n'); return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="goldshore-subscribers.csv"' } }); }
  const rows = await c.env.PLATFORM_DB.prepare(`${select} ${filter} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).bind(...values, pageSize, offset).all(); const count = await c.env.PLATFORM_DB.prepare(`SELECT COUNT(*) total FROM newsletter_subscribers ${filter}`).bind(...values).first<{ total: number }>(); const total = Number(count?.total ?? 0);
  return c.json({ items: rows.results, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
});

mailOperations.post('/audiences/subscribers', requirePermission('email_subscribers:create'), async (c) => {
  const body = await c.req.json<{ email?: string; name?: string; brand?: string; listName?: string; consentBasis?: string }>().catch(() => null); const email = body?.email?.trim().toLowerCase() ?? ''; const brand = body?.brand?.trim().toLowerCase() || 'goldshore'; const listName = body?.listName?.trim().toLowerCase() || 'newsletter';
  if (!isValidEmail(email) || !listIdPattern.test(brand) || !listIdPattern.test(listName) || !body?.consentBasis?.trim() || body.consentBasis.length > 100) return c.json({ error: 'Valid email, brand, list, and consent basis are required.' }, 400);
  const list = await c.env.PLATFORM_DB.prepare("SELECT id FROM email_lists WHERE brand=? AND name=? AND status='active'").bind(brand, listName).first(); if (!list) return c.json({ error: 'Active email list not found.' }, 404);
  const id = crypto.randomUUID(); const now = new Date().toISOString(); const emailHash = await digest(email); const manageTokenHash = await digest(`${crypto.randomUUID()}${crypto.randomUUID()}`);
  try { await c.env.PLATFORM_DB.prepare(`INSERT INTO newsletter_subscribers(id,email,email_hash,name,brand,list_name,source,status,consent_basis,manage_token_hash,subscribed_at) VALUES(?,?,?,?,?,?,?,'pending',?,?,?)`).bind(id, email, emailHash, body.name?.trim() || null, brand, listName, 'admin', body.consentBasis.trim(), manageTokenHash, now).run(); } catch { return c.json({ error: 'Subscriber already exists.' }, 409); }
  await audit(c, 'audience.subscriber.create', { subscriberId: id, brand, listName }); return c.json({ id, email, name: body.name?.trim() || null, brand, list_name: listName, status: 'pending', consent_basis: body.consentBasis.trim(), subscribed_at: now }, 201);
});

mailOperations.patch('/audiences/subscribers/:id', requirePermission('email_subscribers:update'), async (c) => {
  const body = await c.req.json<{ status?: string; confirm?: boolean }>().catch(() => null); if (!body?.status || !subscriberStatuses.has(body.status)) return c.json({ error: 'Valid subscriber status is required.' }, 400); if (['confirmed', 'suppressed'].includes(body.status) && !body.confirm) return c.json({ error: 'Explicit confirmation is required for this status.' }, 409);
  const result = await c.env.PLATFORM_DB.prepare(`UPDATE newsletter_subscribers SET status=?,confirmed_at=CASE WHEN ?='confirmed' THEN COALESCE(confirmed_at,CURRENT_TIMESTAMP) ELSE confirmed_at END,unsubscribed_at=CASE WHEN ?='unsubscribed' THEN CURRENT_TIMESTAMP ELSE unsubscribed_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(body.status, body.status, body.status, c.req.param('id')).run(); if (!result.meta.changes) return c.json({ error: 'Subscriber not found.' }, 404);
  await audit(c, 'audience.subscriber.status', { subscriberId: c.req.param('id'), status: body.status }); return c.json({ success: true, status: body.status });
});

mailOperations.get('/mailboxes', requirePermission('mailboxes:read'), async (c) => {
  const { page, pageSize, offset } = pageArgs(c); const rows = await c.env.PLATFORM_DB.prepare(`SELECT m.id,m.address,m.display_name,m.forward_to,m.status,m.routing_verified,m.created_at,m.updated_at,
    (SELECT COUNT(*) FROM inbound_messages i WHERE lower(i.envelope_to)=lower(m.address)) message_count FROM managed_mailboxes m ORDER BY m.updated_at DESC LIMIT ? OFFSET ?`).bind(pageSize, offset).all(); const count = await c.env.PLATFORM_DB.prepare('SELECT COUNT(*) total FROM managed_mailboxes').first<{ total: number }>(); const total = Number(count?.total ?? 0); return c.json({ items: rows.results, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
});

mailOperations.post('/mailboxes', requirePermission('mailboxes:create'), async (c) => {
  const body = await c.req.json<{ address?: string; displayName?: string; forwardTo?: string }>().catch(() => null); const address = body?.address?.trim().toLowerCase() ?? ''; const forwardTo = body?.forwardTo?.trim().toLowerCase() || null;
  if (!isManagedMailboxAddress(address) || !body?.displayName?.trim() || body.displayName.length > 100 || (forwardTo && !isValidEmail(forwardTo))) return c.json({ error: 'A GoldShore mailbox address, display name, and optional valid forwarding address are required.' }, 400);
  const id = crypto.randomUUID(); try { await c.env.PLATFORM_DB.prepare('INSERT INTO managed_mailboxes(id,address,display_name,forward_to,created_by) VALUES(?,?,?,?,?)').bind(id, address, body.displayName.trim(), forwardTo, getActor(c.get('accessClaims'), c.req.raw)).run(); } catch { return c.json({ error: 'Mailbox already exists.' }, 409); }
  await audit(c, 'mailbox.create', { mailboxId: id, address, forwardingConfigured: Boolean(forwardTo) }); return c.json({ id, address, display_name: body.displayName.trim(), forward_to: forwardTo, status: 'draft', routing_verified: 0 }, 201);
});

mailOperations.patch('/mailboxes/:id', requirePermission('mailboxes:update'), async (c) => {
  const body = await c.req.json<{ status?: string; forwardTo?: string | null; routingVerified?: boolean; confirm?: boolean }>().catch(() => null); if (!body || (body.status && !mailboxStatuses.has(body.status)) || (body.forwardTo && !isValidEmail(body.forwardTo))) return c.json({ error: 'Valid mailbox status and forwarding address are required.' }, 400); if ((body.status === 'active' || body.routingVerified === true) && !body.confirm) return c.json({ error: 'Explicit confirmation is required to activate or verify routing.' }, 409);
  const result = await c.env.PLATFORM_DB.prepare('UPDATE managed_mailboxes SET status=COALESCE(?,status),forward_to=CASE WHEN ? THEN ? ELSE forward_to END,routing_verified=COALESCE(?,routing_verified),updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(body.status ?? null, body.forwardTo !== undefined ? 1 : 0, body.forwardTo?.trim().toLowerCase() || null, body.routingVerified === undefined ? null : body.routingVerified ? 1 : 0, c.req.param('id')).run(); if (!result.meta.changes) return c.json({ error: 'Mailbox not found.' }, 404);
  await audit(c, 'mailbox.update', { mailboxId: c.req.param('id'), status: body.status, routingVerified: body.routingVerified }); return c.json({ success: true });
});

mailOperations.get('/mailboxes/:id/messages', requirePermission('mailboxes:read'), async (c) => {
  const mailbox = await c.env.PLATFORM_DB.prepare('SELECT address FROM managed_mailboxes WHERE id=?').bind(c.req.param('id')).first<{ address: string }>(); if (!mailbox) return c.json({ error: 'Mailbox not found.' }, 404); const { page, pageSize, offset } = pageArgs(c);
  const rows = await c.env.PLATFORM_DB.prepare('SELECT id,envelope_from,envelope_to,subject,message_id,in_reply_to,attachment_count,status,received_at FROM inbound_messages WHERE lower(envelope_to)=lower(?) ORDER BY received_at DESC LIMIT ? OFFSET ?').bind(mailbox.address, pageSize, offset).all(); const count = await c.env.PLATFORM_DB.prepare('SELECT COUNT(*) total FROM inbound_messages WHERE lower(envelope_to)=lower(?)').bind(mailbox.address).first<{ total: number }>(); const total = Number(count?.total ?? 0); return c.json({ mailbox: mailbox.address, items: rows.results, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
});

export default mailOperations;
