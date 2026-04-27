import type { APIRoute } from 'astro';
import {
  buildAdminSession,
  verifyAccessWithClaims,
  type AdminPermission,
  type Env as AccessEnv,
} from '@goldshore/auth';
import { parseJson } from '@goldshore/utils';

/**
 * Admin UI form configuration collection endpoint.
 * Requires `forms:read` for GET and `forms:write` for POST.
 */

const normalizeRow = (row: Record<string, string>) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  status: row.status,
  fields: parseJson(row.fields ?? null, [] as Record<string, unknown>[]),
  recipients: parseJson(row.recipients ?? null, [] as Record<string, unknown>[]),
  integrations: parseJson(row.integrations ?? null, [] as Record<string, unknown>[]),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const isSameOriginRequest = (request: Request) => {
  const expectedOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get('origin');
  if (originHeader) {
    return originHeader === expectedOrigin;
  }

  const refererHeader = request.headers.get('referer');
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) {
    return fetchSite === 'same-origin' || fetchSite === 'none';
  }

  return false;
};

const unauthorizedResponse = () =>
  Response.json({ error: 'Authentication required.' }, { status: 401 });

const forbiddenResponse = (message = 'Insufficient permissions.') =>
  Response.json({ error: message }, { status: 403 });

const requirePermission = async (
  request: Request,
  env: AccessEnv,
  permission: AdminPermission,
) => {
  const claims = await verifyAccessWithClaims(request, env);
  if (!claims) {
    return { response: unauthorizedResponse() };
  }

  const session = buildAdminSession(claims);
  if (!session.permissions.includes(permission)) {
    return { response: forbiddenResponse() };
  }

  return { response: null };
};

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;

  if (!env?.DB) {
    return new Response('Storage unavailable.', { status: 503 });
  }

  const auth = await requirePermission(request, env as AccessEnv, 'forms:read');
  if (auth.response) {
    return auth.response;
  }

  const result = await env.DB.prepare(
    `SELECT id, slug, name, status, fields, recipients, integrations, created_at, updated_at
     FROM form_configs
     ORDER BY updated_at DESC`
  ).all();

  const configs = (result?.results ?? []).map((row: Record<string, string>) => normalizeRow(row));

  return Response.json({ configs });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;

  if (!env?.DB) {
    return new Response('Storage unavailable.', { status: 503 });
  }

  if (!isSameOriginRequest(request)) {
    return forbiddenResponse('Forbidden: CSRF check failed.');
  }

  const auth = await requirePermission(request, env as AccessEnv, 'forms:write');
  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json()) as {
    slug?: string;
    name?: string;
    status?: string;
    fields?: Record<string, unknown>[];
    recipients?: Record<string, unknown>[];
    integrations?: Record<string, unknown>[];
  };

  if (!payload.slug || !payload.name) {
    return new Response('Missing required fields.', { status: 400 });
  }

  const existing = await env.DB.prepare('SELECT id FROM form_configs WHERE slug = ? LIMIT 1')
    .bind(payload.slug)
    .all();

  if (existing?.results?.length) {
    return new Response('Form config already exists.', { status: 409 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO form_configs (
      id,
      slug,
      name,
      status,
      fields,
      recipients,
      integrations,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      payload.slug,
      payload.name,
      payload.status ?? 'active',
      JSON.stringify(payload.fields ?? []),
      JSON.stringify(payload.recipients ?? []),
      JSON.stringify(payload.integrations ?? []),
      now,
      now
    )
    .run();

  return Response.json({ id, slug: payload.slug, status: payload.status ?? 'active' }, { status: 201 });
};

export const __testing = {
  isSameOriginRequest,
  requirePermission,
};
