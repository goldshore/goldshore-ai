import type { APIRoute } from 'astro';
import { requireAdminAccess } from '../../../lib/access';
import { getServerEnv } from '../../../lib/server-env';
import { proxyToTrading } from '../../../lib/trading-api';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getServerEnv(locals as Record<string, unknown>);
  const access = await requireAdminAccess(request, env);
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error }), {
      status: access.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await proxyToTrading(env, '/api/trading/risk', request);
  const data = await res.json().catch(() => null);
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getServerEnv(locals as Record<string, unknown>);
  const access = await requireAdminAccess(request, env, { requiredRole: 'admin' });
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error }), {
      status: access.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: string;
  try {
    body = JSON.stringify(await request.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await proxyToTrading(env, '/api/trading/risk/check', request, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json().catch(() => null);
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
