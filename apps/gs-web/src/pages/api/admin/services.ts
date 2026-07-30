import type { APIRoute } from 'astro';
import {
  buildAdminSession,
  verifyAccessWithClaims,
  type Env as AccessEnv,
} from '@goldshore/auth';

export const prerender = false;

const WORKFLOW_STATUSES = new Set(['new', 'read', 'approved', 'rejected', 'archived']);

const hasPermission = async (
  request: Request,
  env: AccessEnv & Env,
  permission: 'forms:read' | 'forms:write' | 'system:read',
) => {
  const claims = await verifyAccessWithClaims(request, env);
  if (!claims) return false;
  const session = buildAdminSession(claims);
  return session.permissions.includes(permission);
};

const isSameOriginRequest = (request: Request) => {
  const expectedOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get('origin');
  if (originHeader) return originHeader === expectedOrigin;
  const referer = request.headers.get('referer');
  if (referer) {
    try { return new URL(referer).origin === expectedOrigin; } catch { return false; }
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'none';
  return false;
};

// GET /api/admin/services?type=&status=
export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.PLATFORM_DB) return new Response('Storage unavailable.', { status: 503 });

  const ok = await hasPermission(request, env as never, 'forms:read');
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const typeFilter = url.searchParams.get('type');
  const statusFilter = url.searchParams.get('status');

  const SERVICE_TYPES = [
    'contact',
    'foundations-sprint',
    'automation-launch',
    'ai-ops-accelerator',
    'embedded-delivery',
  ] as const;

  const SERVICE_NAMES: Record<string, string> = {
    contact: 'General Contact',
    'foundations-sprint': 'Foundations Sprint',
    'automation-launch': 'Automation Launch',
    'ai-ops-accelerator': 'AI Ops Accelerator',
    'embedded-delivery': 'Embedded Delivery Partner',
  };

  const conditions: string[] = [];
  const bindings: (string | null)[] = [];

  if (typeFilter && (SERVICE_TYPES as readonly string[]).includes(typeFilter)) {
    conditions.push('form_type = ?');
    bindings.push(typeFilter);
  }
  if (statusFilter && WORKFLOW_STATUSES.has(statusFilter)) {
    conditions.push('status = ?');
    bindings.push(statusFilter);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = env.PLATFORM_DB.prepare(
    `SELECT id, form_type, name, email, company, role, timeline, budget, goals, message, status, received_at
     FROM lead_submissions ${where}
     ORDER BY received_at DESC LIMIT 200`,
  );
  const result = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();
  const rows = (result?.results ?? []) as Record<string, unknown>[];

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

  return Response.json({ success: true, workflows: rows, summary });
};

// POST /api/admin/services — update workflow status
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.PLATFORM_DB) return new Response('Storage unavailable.', { status: 503 });

  if (!isSameOriginRequest(request)) return new Response('Forbidden: CSRF check failed.', { status: 403 });

  const ok = await hasPermission(request, env as never, 'forms:write');
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const body = await request.json() as { id?: string; status?: string };
  const { id, status } = body ?? {};

  if (!id || !status || !WORKFLOW_STATUSES.has(status)) {
    return new Response('id and valid status required.', { status: 400 });
  }

  const check = await env.PLATFORM_DB.prepare(
    'SELECT id FROM lead_submissions WHERE id = ? LIMIT 1',
  ).bind(id).all();
  if (!check?.results?.length) return new Response('Workflow not found.', { status: 404 });

  await env.PLATFORM_DB.prepare('UPDATE lead_submissions SET status = ? WHERE id = ?')
    .bind(status, id)
    .run();

  return Response.json({ success: true, id, status });
};
