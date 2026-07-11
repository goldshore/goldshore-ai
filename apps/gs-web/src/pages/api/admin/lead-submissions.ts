import type { APIRoute } from 'astro';


const isSameOriginRequest = (request: Request) => {
  const expectedOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get('origin');
  if (originHeader) return originHeader === expectedOrigin;
  const refererHeader = request.headers.get('referer');
  if (refererHeader) {
    try { return new URL(refererHeader).origin === expectedOrigin; } catch { return false; }
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'none';
  return false;
};

const apiBase = (env: Env | undefined) =>
  (env?.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');

const proxy = async (request: Request, env: Env | undefined) => {
  const incoming = new URL(request.url);
  const target = new URL(`${apiBase(env)}/v1/forms/leads`);
  target.search = incoming.search;
  const headers = new Headers(request.headers);
  headers.set('x-forwarded-host', incoming.host);
  return fetch(target, { method: request.method, headers, body: request.method === 'GET' ? undefined : request.body, redirect: 'manual' });
};

export const GET: APIRoute = async ({ request, locals }) => proxy(request, locals.runtime?.env as Env | undefined);
export const POST: APIRoute = async ({ request, locals }) => proxy(request, locals.runtime?.env as Env | undefined);

export const __testing = { isSameOriginRequest };
