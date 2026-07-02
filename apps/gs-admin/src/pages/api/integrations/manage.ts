import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  try {
    const gsApiUrl = import.meta.env.PUBLIC_GS_API_URL || 'https://api.goldshore.ai';
    const action = url.searchParams.get('action') || 'list';

    const response = await fetch(`${gsApiUrl}/integrations?action=${encodeURIComponent(action)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Integration management proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const gsApiUrl = import.meta.env.PUBLIC_GS_API_URL || 'https://api.goldshore.ai';

    const response = await fetch(`${gsApiUrl}/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Integration creation proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
