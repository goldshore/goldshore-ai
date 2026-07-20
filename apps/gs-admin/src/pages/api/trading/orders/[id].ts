import type { APIRoute } from 'astro';
import { requireAdminAccess } from '../../../../lib/access';
import { getServerEnv } from '../../../../lib/server-env';
import { proxyToTrading } from '../../../../lib/trading-api';

export const DELETE: APIRoute = async ({ request, locals, params, url }) => {
  const env = getServerEnv(locals as Record<string, unknown>);
  const access = await requireAdminAccess(request, env, { requiredPermission: 'system:write' });
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error }), {
      status: access.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  const broker = url.searchParams.get('broker') ?? '';
  const res = await proxyToTrading(env, request, `/api/trading/orders/${id}?broker=${broker}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => null);
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
