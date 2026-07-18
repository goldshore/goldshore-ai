import type { APIRoute } from 'astro';
import {
  buildAdminSession,
  verifyAccessWithClaims,
  type AdminPermission,
  type Env as AccessEnv,
} from '@goldshore/auth';
import { parseJson } from '@goldshore/utils';

/**
 * Admin UI form configuration item endpoint.
 * Requires `forms:read` for GET and `forms:write` for PUT/PATCH.
 */

export const prerender = false;

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

export const GET: APIRoute = async ({ request, locals, params }) => {
  const env = locals.runtime?.env as Env | undefined;
  const slug = params.slug;

  if (!env?.DB) {
    return new Response('Storage unavailable.', { status: 503 });
  }

  const auth = await requirePermission(request, env as AccessEnv, 'forms:read');
  if (auth.response) {
    return auth.response;
  }

  if (!slug) {
    return new Response('Form slug is required.', { status: 400 });
  }

  const result = await env.DB.prepare(
    `SELECT id, slug, name, status, fields, recipients, integrations, created_at, updated_at
     FROM form_configs
     WHERE slug = ?
     LIMIT 1`
  )
    .bind(slug)
    .all();

  const row = result?.results?.[0] as Record<string, string> | undefined;
  if (!row) {
    return new Response('Form not found.', { status: 404 });
  }

  return Response.json({ config: normalizeRow(row) });
};

export const PUT: APIRoute = async ({ request, locals, params }) => {
  const env = locals.runtime?.env as Env | undefined;
  const slug = params.slug;

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

  if (!slug) {
    return new Response('Form slug is required.', { status: 400 });
  }

  const payload = (await request.json()) as {
    name?: string;
    status?: string;
    fields?: Record<string, unknown>[];
    recipients?: Record<string, unknown>[];
    integrations?: Record<string, unknown>[];
  };

  const existing = await env.DB.prepare(
    `SELECT id, slug, name, status, fields, recipients, integrations, created_at, updated_at
     FROM form_configs
     WHERE slug = ?
     LIMIT 1`
  )
    .bind(slug)
    .all();

  const row = existing?.results?.[0] as Record<string, string> | undefined;
  if (!row) {
    return new Response('Form not found.', { status: 404 });
  }

  const updated = {
    name: payload.name ?? row.name,
    status: payload.status ?? row.status,
    fields: payload.fields ?? parseJson(row.fields ?? null, [] as Record<string, unknown>[]),
    recipients: payload.recipients ?? parseJson(row.recipients ?? null, [] as Record<string, unknown>[]),
    integrations: payload.integrations ?? parseJson(row.integrations ?? null, [] as Record<string, unknown>[]),
  };

  const now = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE form_configs
     SET name = ?, status = ?, fields = ?, recipients = ?, integrations = ?, updated_at = ?
     WHERE slug = ?`
  )
    .bind(
      updated.name,
      updated.status,
      JSON.stringify(updated.fields),
      JSON.stringify(updated.recipients),
      JSON.stringify(updated.integrations),
      now,
      slug
    )
    .run();

  return Response.json({
    config: {
      id: row.id,
      slug,
      name: updated.name,
      status: updated.status,
      fields: updated.fields,
      recipients: updated.recipients,
      integrations: updated.integrations,
      createdAt: row.created_at,
      updatedAt: now,
    },
  });
};

export const PATCH = PUT;

export const __testing = {
  isSameOriginRequest,
  requirePermission,
};
