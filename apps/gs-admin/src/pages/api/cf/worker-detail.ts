import type { APIRoute } from 'astro';
import { getServerEnv } from '../../../lib/server-env';

type ControlEnv = {
  GS_CONTROL?: { fetch(req: Request): Promise<Response> };
};

export const GET: APIRoute = async ({ request, url, locals }) => {
  const env = getServerEnv(locals as Record<string, unknown>) as ControlEnv;

  const name = url.searchParams.get('name');
  if (!name) {
    return new Response(JSON.stringify({ error: 'Missing required query param: name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.GS_CONTROL) {
    return new Response(JSON.stringify({ error: 'GS_CONTROL binding not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch DNS records — filter for routes belonging to this worker
  const dnsRes = await env.GS_CONTROL.fetch(
    new Request('https://gs-control/cloudflare/dns/records?per_page=100', {
      headers: request.headers,
    })
  );

  let routes: Array<{ pattern: string; zone_name?: string; created_on?: string }> = [];
  if (dnsRes.ok) {
    const dnsData = await dnsRes.json() as { result?: Array<{ name: string; content?: string; created_on?: string }> };
    routes = (dnsData.result ?? [])
      .filter((r) => r.content === name || r.name?.includes(name))
      .map((r) => ({ pattern: r.name, created_on: r.created_on }));
  }

  return new Response(
    JSON.stringify({
      bindings: [],
      _bindingsNote: 'Per-worker bindings require a /cloudflare/workers/:name/bindings endpoint in gs-control',
      routes,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
