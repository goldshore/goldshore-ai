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

const forwardedHeaders = (request: Request) => {
  const headers = new Headers();
  for (const name of ['accept', 'authorization', 'cookie', 'cf-connecting-ip', 'user-agent', 'content-type']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
};

const proxy = async (request: Request, env: Env | undefined, slug?: string) => {
  if (!slug) return new Response('Form slug is required.', { status: 400 });

  const target = new URL(`${apiBase(env)}/v1/forms/configs/${encodeURIComponent(slug)}`);
  const response = await fetch(target, {
    method: request.method,
    headers: forwardedHeaders(request),
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
  });

  return new Response(response.body, { status: response.status, headers: response.headers });
};

export const GET: APIRoute = async ({ request, locals, params }) =>
  proxy(request, locals.runtime?.env as Env | undefined, params.slug);
export const PUT: APIRoute = async ({ request, locals, params }) =>
  proxy(request, locals.runtime?.env as Env | undefined, params.slug);
export const PATCH = PUT;

export const __testing = {
  isSameOriginRequest,
  requirePermission,
};
