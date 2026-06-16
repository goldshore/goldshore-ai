import type { APIRoute } from 'astro';
import { getServerEnv } from '../../../lib/server-env';

type ControlEnv = {
  GS_CONTROL?: { fetch(req: Request): Promise<Response> };
};

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getServerEnv(locals as Record<string, unknown>) as ControlEnv;

  if (!env.GS_CONTROL) {
    return new Response(JSON.stringify({ error: 'GS_CONTROL binding not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const upstream = new Request('https://gs-control/cloudflare/workers/status', {
    headers: request.headers,
  });

  const res = await env.GS_CONTROL.fetch(upstream);
  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
