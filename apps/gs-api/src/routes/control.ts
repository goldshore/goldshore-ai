import { Hono } from 'hono';
import { parseSystemSyncWritePayload } from '@goldshore/schema';

const control = new Hono();

const hasAdminRole = (claims: any, env: any) => {
  const required = (env.CONTROL_ADMIN_ROLES ?? 'admin,ops').split(',').map((r: string) => r.trim()).filter(Boolean);
  const roles = Array.isArray(claims?.roles) ? claims.roles : [];
  return roles.some((role: string) => required.includes(role));
};

control.use('*', async (c, next) => {
  if (
    c.req.path === '/' ||
    c.req.path === '/health' ||
    c.req.path === '/admin/control/health'
  ) return next();
  if (!hasAdminRole(c.get('accessClaims'), c.env)) return c.json({ error: 'Forbidden' }, 403);
  return next();
});

control.get('/', (c) => c.json({ service: 'gs-api-control', ok: true }));
control.get('/health', (c) => c.json({ status: 'ok', service: 'gs-api-control' }));
control.post('/system/sync', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const parsed = parseSystemSyncWritePayload(body);
  if (!parsed.success) return c.json({ error: 'Validation Failed', details: parsed.error.format() }, 400);
  const kv = (c.env as any).KV;
  const logs = (c.env as any).CONTROL_LOGS ?? kv;
  if (!kv) return c.json({ error: 'Missing KV binding.' }, 500);
  const timestamp = new Date().toISOString();
  await Promise.all([
    kv.put('ROUTING_TABLE', JSON.stringify(parsed.data.ROUTING_TABLE)),
    kv.put('SERVICE_STATUS', JSON.stringify(parsed.data.SERVICE_STATUS)),
    kv.put('AI_ORCHESTRATION', JSON.stringify(parsed.data.AI_ORCHESTRATION)),
    logs?.put?.(`sync_${Date.now()}`, JSON.stringify({ user: c.get('accessClaims')?.email, timestamp })),
  ]);
  return c.json({ success: true, syncedAt: timestamp });
});
control.post('/dns/apply', (c) => c.json({ accepted: true, action: 'dns.apply', note: 'Handled in gs-api control route.' }));
control.post('/workers/reconcile', (c) => c.json({ accepted: true, action: 'workers.reconcile', note: 'Handled in gs-api control route.' }));
control.post('/pages/deploy', (c) => c.json({ accepted: true, action: 'pages.deploy', note: 'Handled in gs-api control route.' }));
control.post('/access/audit', (c) => c.json({ accepted: true, action: 'access.audit', note: 'Handled in gs-api control route.' }));

export default control;
