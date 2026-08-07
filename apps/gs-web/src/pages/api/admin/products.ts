import type { APIRoute } from 'astro';
import {
  buildAdminSession,
  verifyAccessWithClaims,
  type Env as AccessEnv,
} from '@goldshore/auth';

/**
 * Admin UI product catalog endpoint.
 *
 * This is a thin proxy onto the gs-api `/v1/products` routes, which own the
 * `PRODUCT_CATALOG` KV key. gs-web must NOT read or write that key directly:
 * its own `KV` binding points at a different namespace (`GOLDSHORE-AI`) than
 * gs-api's (`GS_API_KV`), so a direct write here would create a second,
 * silently diverging copy of the catalog.
 *
 * Requires `system:read` for GET and `system:write` for PUT/PATCH. gs-api
 * re-checks the same permissions from the forwarded Access JWT.
 */

export const prerender = false;

const apiBase = (env: Env | undefined) =>
  (env?.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');

const forwardedHeaders = (request: Request) => {
  const headers = new Headers();
  for (const name of ['cookie', 'cf-access-jwt-assertion', 'authorization', 'accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
};

const hasPermission = async (
  request: Request,
  env: AccessEnv & Env,
  permission: 'system:read' | 'system:write',
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

/** Pass an upstream gs-api response through unchanged. */
const relay = (response: Response) =>
  new Response(response.body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
    },
  });

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env) return new Response('Storage unavailable.', { status: 503 });

  const ok = await hasPermission(request, env as never, 'system:read');
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  const target = `${apiBase(env)}/v1/products${id ? `/${encodeURIComponent(id)}` : ''}`;

  try {
    return relay(await fetch(target, { headers: forwardedHeaders(request) }));
  } catch {
    return new Response('Unable to reach the platform API.', { status: 502 });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env) return new Response('Storage unavailable.', { status: 503 });

  if (!isSameOriginRequest(request)) {
    return new Response('Forbidden: CSRF check failed.', { status: 403 });
  }

  const ok = await hasPermission(request, env as never, 'system:write');
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return new Response('id query param required.', { status: 400 });

  const headers = forwardedHeaders(request);
  headers.set('content-type', 'application/json');

  try {
    return relay(
      await fetch(`${apiBase(env)}/v1/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers,
        body: await request.text(),
      }),
    );
  } catch {
    return new Response('Unable to reach the platform API.', { status: 502 });
  }
};

export const PATCH = PUT;

export const __testing = {
  isSameOriginRequest,
  forwardedHeaders,
};
