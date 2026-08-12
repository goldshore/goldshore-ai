import { Hono } from 'hono';
import { requirePermission, getActor, logAdminAction } from '../auth';
import type { Env, Variables } from '../types';

const services = new Hono<{ Bindings: Env; Variables: Variables }>();

const WORKFLOW_STATUSES = new Set(['new', 'read', 'approved', 'rejected', 'archived']);

const SERVICE_TYPES = [
  'contact',
  'foundations-sprint',
  'automation-launch',
  'ai-ops-accelerator',
  'embedded-delivery',
] as const;
type ServiceType = (typeof SERVICE_TYPES)[number];

const SERVICE_NAMES: Record<ServiceType, string> = {
  contact: 'General Contact',
  'foundations-sprint': 'Foundations Sprint',
  'automation-launch': 'Automation Launch',
  'ai-ops-accelerator': 'AI Ops Accelerator',
  'embedded-delivery': 'Embedded Delivery Partner',
};

// GET /services/workflows?type=&status=
services.get('/workflows', requirePermission('forms:read'), async (c) => {
  const actor = getActor(c.get('accessClaims'), c.req.raw);
  const typeFilter = c.req.query('type') as ServiceType | undefined;
  const statusFilter = c.req.query('status');

  const conditions: string[] = [];
  const bindings: (string | null)[] = [];

  if (typeFilter && SERVICE_TYPES.includes(typeFilter)) {
    conditions.push('form_type = ?');
    bindings.push(typeFilter);
  }
  if (statusFilter && WORKFLOW_STATUSES.has(statusFilter)) {
    conditions.push('status = ?');
    bindings.push(statusFilter);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = c.env.PLATFORM_DB.prepare(
    `SELECT id, form_type, name, email, company, role, timeline, budget, goals, message, status, received_at
     FROM lead_submissions ${where}
     ORDER BY received_at DESC LIMIT 200`,
  );
  const result = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();
  const rows = (result?.results ?? []) as Record<string, unknown>[];

  // Build summary by service type
  const summary: Record<string, { name: string; count: number; byStatus: Record<string, number> }> =
    Object.fromEntries(
      SERVICE_TYPES.map((t) => [t, { name: SERVICE_NAMES[t], count: 0, byStatus: {} }]),
    );

  for (const row of rows) {
    const t = (row.form_type as string) || 'contact';
    if (summary[t]) {
      summary[t].count++;
      const s = (row.status as string) || 'new';
      summary[t].byStatus[s] = (summary[t].byStatus[s] ?? 0) + 1;
    }
  }

  await logAdminAction(c.env, {
    action: 'services.workflows.list',
    actor,
    status: 'success',
    metadata: { count: rows.length, filter: typeFilter ?? 'all' },
  });

  return c.json({ success: true, workflows: rows, summary });
});

// PATCH /services/workflows/:id
services.patch('/workflows/:id', requirePermission('forms:write'), async (c) => {
  const actor = getActor(c.get('accessClaims'), c.req.raw);
  const { id } = c.req.param();
  const body = await c.req.json<{ status?: string; notes?: string }>().catch(() => null);

  if (!body?.status || !WORKFLOW_STATUSES.has(body.status)) {
    return c.json({ error: 'Valid status required.' }, 400);
  }

  const now = new Date().toISOString();
  const check = await c.env.PLATFORM_DB.prepare(
    'SELECT id FROM lead_submissions WHERE id = ? LIMIT 1',
  )
    .bind(id)
    .all();
  if (!check?.results?.length) return c.json({ error: 'Workflow not found.' }, 404);

  await c.env.PLATFORM_DB.prepare('UPDATE lead_submissions SET status = ? WHERE id = ?')
    .bind(body.status, id)
    .run();

  await logAdminAction(c.env, {
    action: 'services.workflow.update',
    actor,
    status: 'success',
    metadata: { id, newStatus: body.status },
  });

  return c.json({ success: true, id, status: body.status, updatedAt: now });
});

// GET /services/catalog
services.get('/catalog', requirePermission('system:read'), async (c) => {
  const stored = await c.env.KV.get('SERVICE_CATALOG', 'json');
  const catalog = (stored as Record<string, unknown> | null) ?? {
    services: SERVICE_TYPES.map((type) => ({
      type,
      name: SERVICE_NAMES[type],
      status: 'active',
      cta: type === 'contact' ? '/contact' : `/contact?intent=${type}`,
    })),
  };
  return c.json({ success: true, catalog });
});

// PUT /services/catalog
services.put('/catalog', requirePermission('system:write'), async (c) => {
  const actor = getActor(c.get('accessClaims'), c.req.raw);
  const body = await c.req.json<{ services: unknown[] }>().catch(() => null);
  if (!body?.services || !Array.isArray(body.services)) {
    return c.json({ error: 'services array required' }, 400);
  }

  await c.env.KV.put('SERVICE_CATALOG', JSON.stringify(body));
  await logAdminAction(c.env, {
    action: 'services.catalog.update',
    actor,
    status: 'success',
    metadata: { count: body.services.length },
  });

  return c.json({ success: true, catalog: body });
});

export default services;
