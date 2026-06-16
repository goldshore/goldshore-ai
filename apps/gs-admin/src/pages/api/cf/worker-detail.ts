import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const accountId = import.meta.env.CF_ACCOUNT_ID;
  const apiToken = import.meta.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return new Response(JSON.stringify({ error: 'CF credentials not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const name = url.searchParams.get('name');
  if (!name) {
    return new Response(JSON.stringify({ error: 'Missing required query param: name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const headers = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  };

  const [bindingsRes, routesRes] = await Promise.all([
    fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${encodeURIComponent(name)}/bindings`,
      { headers }
    ),
    fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/routes?zone_name=goldshore.ai`,
      { headers }
    )
  ]);

  if (!bindingsRes.ok) {
    return new Response(JSON.stringify({ error: 'CF API error fetching bindings', status: bindingsRes.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!routesRes.ok) {
    return new Response(JSON.stringify({ error: 'CF API error fetching routes', status: routesRes.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const bindingsData = await bindingsRes.json();
  const routesData = await routesRes.json();

  const allRoutes: Array<{ script: string; pattern: string; zone_name?: string; created_on?: string }> =
    routesData.result ?? [];
  const filteredRoutes = allRoutes.filter((r) => r.script === name);

  return new Response(
    JSON.stringify({
      bindings: bindingsData.result ?? [],
      routes: filteredRoutes
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
