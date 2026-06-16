import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const accountId = import.meta.env.CF_ACCOUNT_ID;
  const apiToken = import.meta.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return new Response(JSON.stringify({ error: 'CF credentials not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!cfRes.ok) {
    return new Response(JSON.stringify({ error: 'CF API error', status: cfRes.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const data = await cfRes.json();

  return new Response(JSON.stringify({ result: data.result ?? [], accountId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
