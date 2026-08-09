import { Hono } from 'hono';
import { getActor, requirePermission } from '../auth';
import { emergencyRevoke, invokeConnector, listCapabilities } from '../integrations/service';
import type { ConnectorAudience } from '../integrations/types';
import type { Env, Variables } from '../types';

const connectors = new Hono<{ Bindings: Env; Variables: Variables }>();
connectors.get('/capabilities', requirePermission('system:read'), async (c) => {
  const audience = c.req.query('audience') === 'ai' ? 'ai' : 'admin';
  return c.json({ data: await listCapabilities({ env: c.env }, audience) });
});
connectors.post('/:connector/invoke', requirePermission('system:integrations:manage'), async (c) => {
  try {
    const body = await c.req.json<{ operation?: string; input?: Record<string, unknown>; audience?: ConnectorAudience; idempotencyKey?: string; approvalId?: string }>();
    if (!body.operation || !body.input || !body.idempotencyKey || !/^[A-Za-z0-9._:-]{16,128}$/.test(body.idempotencyKey)) return c.json({ error: 'operation, input, and a valid idempotencyKey are required' }, 400);
    const actor = getActor(c.get('accessClaims'), c.req.raw);
    const result = await invokeConnector({ env: c.env }, c.req.param('connector'), { operation: body.operation, input: body.input, audience: body.audience === 'ai' ? 'ai' : 'admin', idempotencyKey: body.idempotencyKey, approvalId: body.approvalId, actor });
    return c.json({ data: result });
  } catch (error) { return c.json({ error: error instanceof Error ? error.message : 'Connector invocation failed' }, 400); }
});
connectors.post('/:connector/revoke', requirePermission('system:integrations:manage'), async (c) => {
  const body = await c.req.json<{ reason?: string }>(); if (!body.reason || body.reason.length < 8) return c.json({ error: 'A revocation reason is required' }, 400);
  await emergencyRevoke({ env: c.env }, c.req.param('connector'), getActor(c.get('accessClaims'), c.req.raw), body.reason); return c.json({ revoked: true });
});
export default connectors;
