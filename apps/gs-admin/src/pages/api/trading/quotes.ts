import type { APIRoute } from 'astro';
import { requireAdminAccess } from '../../../lib/access';
import { getServerEnv } from '../../../lib/server-env';
import { proxyToTrading } from '../../../lib/trading-api';

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getServerEnv(locals as Record<string, unknown>);
  const access = await requireAdminAccess(request, env);
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error }), {
      status: access.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const symbols = url.searchParams.get('symbols') ?? 'SPY,QQQ,AAPL,TSLA,NVDA';
  const broker = url.searchParams.get('broker');
  const qs = broker
    ? `?symbols=${symbols}&broker=${broker}`
    : `?symbols=${symbols}`;
  const res = await proxyToTrading(env, `/trading/quotes${qs}`);
  const data = await res.json().catch(() => null);
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
