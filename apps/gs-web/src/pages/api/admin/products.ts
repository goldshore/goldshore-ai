import type { APIRoute } from 'astro';
import {
  buildAdminSession,
  verifyAccessWithClaims,
  type Env as AccessEnv,
} from '@goldshore/auth';

export const prerender = false;

/**
 * Admin UI product catalog endpoint.
 *
 * This route is a thin authenticated proxy in front of gs-api's `/products`
 * routes, which are the sole owner of the PRODUCT_CATALOG key. It deliberately
 * does NOT touch `env.KV`: gs-web's `KV` binding resolves to the GOLDSHORE-AI
 * namespace while gs-api's resolves to GS_API_KV, so reading or writing the
 * catalog here would fork it into two stores that diverge silently.
 */

const apiBase = (env: Env | undefined) =>
  (env?.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');

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

/** Forward only the headers gs-api needs to re-authenticate the caller. */
const forwardedHeaders = (request: Request) => {
  const headers = new Headers();
  for (const name of ['accept', 'authorization', 'cookie', 'cf-access-jwt-assertion']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
};

const upstream = async (
  request: Request,
  env: Env | undefined,
  path: string,
  init?: { method?: string; body?: string },
) => {
  const headers = forwardedHeaders(request);
  if (init?.body !== undefined) headers.set('content-type', 'application/json');

  try {
    const response = await fetch(`${apiBase(env)}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body,
    });

    const contentType = response.headers.get('content-type') ?? 'application/json';
    return new Response(response.body, {
      status: response.status,
      headers: { 'content-type': contentType },
    });
  } catch {
    return new Response('Unable to reach the product catalog service.', { status: 502 });
  }
};

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;

  const ok = await hasPermission(request, env as never, 'system:read');
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  const path = id ? `/products/${encodeURIComponent(id)}` : '/products';

  return upstream(request, env, path);
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;

  if (!isSameOriginRequest(request)) return new Response('Forbidden: CSRF check failed.', { status: 403 });

  const ok = await hasPermission(request, env as never, 'system:write');
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return new Response('id query param required.', { status: 400 });

  const body = await request.text();

  return upstream(request, env, `/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  });
};

export const PATCH = PUT;

export const __testing = {
  isSameOriginRequest,
  forwardedHeaders,
};
