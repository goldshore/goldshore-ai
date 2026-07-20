import type { APIRoute } from 'astro';

const ACCESS_ASSERTION_HEADER = 'CF-Access-Jwt-Assertion';
const ACCESS_COOKIE_HEADER = 'Cookie';

export const buildGsApiAccessHeaders = (request: Request): Headers => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const accessAssertion = request.headers.get(ACCESS_ASSERTION_HEADER);
  if (accessAssertion) {
    headers.set(ACCESS_ASSERTION_HEADER, accessAssertion);
  }

  const accessCookie = request.headers.get(ACCESS_COOKIE_HEADER);
  if (accessCookie) {
    headers.set(ACCESS_COOKIE_HEADER, accessCookie);
  }

  return headers;
};

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const gsApiUrl = import.meta.env.PUBLIC_GS_API_URL || 'https://api.goldshore.ai';
    const action = url.searchParams.get('action') || 'list';

    const headers = buildGsApiAccessHeaders(request);

    const response = await fetch(`${gsApiUrl}/integrations?action=${encodeURIComponent(action)}`, {
      method: 'GET',
      headers,
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

    const headers = buildGsApiAccessHeaders(request);

    const response = await fetch(`${gsApiUrl}/integrations`, {
      method: 'POST',
      headers,
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
