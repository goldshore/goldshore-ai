import type { APIRoute } from 'astro';
import {
  buildAdminSession,
  verifyAccessWithClaims,
  type Env as AccessEnv,
} from '@goldshore/auth';

const allowedStatuses = new Set(['pending', 'confirmed', 'unsubscribed', 'suppressed', 'invalid']);
const escapeCsvValue = (value: unknown) =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

const hasReadPermission = async (request: Request, env: AccessEnv & Env) => {
  const claims = await verifyAccessWithClaims(request, env);
  return claims ? buildAdminSession(claims).permissions.includes('forms:read') : false;
};

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as (AccessEnv & Env) | undefined;
  if (!env || !(await hasReadPermission(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const filteredStatus = status && allowedStatuses.has(status) ? status : null;
  const query = `SELECT id, email, name, brand, list_name, source, status, consent_basis,
    subscribed_at, confirmed_at, unsubscribed_at, updated_at
    FROM newsletter_subscribers
    ${filteredStatus ? 'WHERE status = ?' : ''}
    ORDER BY updated_at DESC`;
  const statement = env.PLATFORM_DB.prepare(query);
  const response = filteredStatus
    ? await statement.bind(filteredStatus).all()
    : await statement.all();
  const rows = (response.results ?? []) as Record<string, unknown>[];

  if (url.searchParams.get('format') === 'csv') {
    const columns = [
      'id', 'email', 'name', 'brand', 'list_name', 'source', 'status',
      'consent_basis', 'subscribed_at', 'confirmed_at', 'unsubscribed_at', 'updated_at',
    ];
    const csv = [
      columns.map(escapeCsvValue).join(','),
      ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(',')),
    ].join('\n');
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="newsletter-subscribers.csv"',
      },
    });
  }

  return Response.json({ subscribers: rows });
};

