export const proxyApiRequest = async (request: Request, apiPath: string, apiBase?: string) => {
  const base = (apiBase || import.meta.env.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');
  const sourceUrl = new URL(request.url);
  const target = new URL(`${base}${apiPath}`);
  for (const [key, value] of sourceUrl.searchParams) target.searchParams.append(key, value);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', sourceUrl.host);
  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });
  return new Response(response.body, { status: response.status, headers: response.headers });
};
