type ServiceBinding = Fetcher;

export const proxyApiRequest = async (
  request: Request,
  apiPath: string,
  apiBase?: string,
  serviceBinding?: ServiceBinding
) => {
  const sourceUrl = new URL(request.url);

  let targetUrl: URL;
  let response: Response;

  if (serviceBinding) {
    // Use service binding for internal RPC (bypasses Cloudflare Access)
    const base = 'http://api.internal';
    targetUrl = new URL(`${base}${apiPath}`);
    for (const [key, value] of sourceUrl.searchParams) targetUrl.searchParams.append(key, value);

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('x-forwarded-host', sourceUrl.host);

    console.log(`[proxyApiRequest:binding] ${request.method} ${apiPath} via service binding`);

    response = await serviceBinding.fetch(new Request(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    }));
  } else {
    // Use public HTTPS fetch (may hit Cloudflare Access)
    const base = (apiBase || import.meta.env.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');
    targetUrl = new URL(`${base}${apiPath}`);
    for (const [key, value] of sourceUrl.searchParams) targetUrl.searchParams.append(key, value);

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('x-forwarded-host', sourceUrl.host);

    // Extract CF Access JWT from cookies if not already in headers
    // Cloudflare Access stores the JWT in CF_Authorization cookie
    if (!headers.get('CF-Access-JWT-Assertion')) {
      const cookieHeader = headers.get('cookie');
      if (cookieHeader) {
        const cfAuthCookie = cookieHeader
          .split(';')
          .find(c => c.trim().startsWith('CF_Authorization='));
        if (cfAuthCookie) {
          const jwtValue = cfAuthCookie.split('=')[1]?.trim();
          if (jwtValue) {
            headers.set('CF-Access-JWT-Assertion', jwtValue);
          }
        }
      }
    }

    // Log auth headers for debugging
    const authHeaders = {
      'CF-Access-JWT-Assertion': headers.get('CF-Access-JWT-Assertion') ? '***present***' : 'missing',
      'CF-Access-Client-Id': headers.get('CF-Access-Client-Id') ? '***present***' : 'missing',
      'Authorization': headers.get('Authorization') ? headers.get('Authorization')?.substring(0, 20) + '...' : 'missing',
    };
    console.log(`[proxyApiRequest:fetch] ${request.method} ${targetUrl.pathname} | Auth headers:`, authHeaders);

    response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });

    if (!response.ok) {
      console.error(
        `[proxyApiRequest:fetch] Response failed | ${request.method} ${targetUrl.pathname} | Status: ${response.status}`
      );
    }
  }

  return new Response(response.body, { status: response.status, headers: response.headers });
};

// Every admin route proxies to gs-api. Left to call proxyApiRequest directly,
// every one of them silently fell through to the public-HTTPS branch above,
// which forwards the visitor's admin.goldshore.ai Access JWT (audience
// c520a76...) to api.goldshore.ai, whose own Access application checks for a
// *different* audience (8510d42c...). That JWT is invalid for gs-api's Access
// app, so Access returns its own HTML login page instead of gs-api's JSON —
// the "Unexpected token '<'" failures across the admin dashboard. gs-api's
// Access policy already trusts a Linked App Token from admin-production
// (see infra/Cloudflare/BINDINGS_MAP.md), and gs-web already has a service
// binding (`API`) that bypasses Cloudflare Access entirely for this internal
// hop — exactly like apps/gs-web/src/pages/api/contact.ts already does. This
// helper is that same pattern, centralized so every admin route uses it.
export const proxyAdminRequest = async (
  request: Request,
  apiPath: string,
  apiBase?: string
) => {
  let serviceBinding: ServiceBinding | undefined;
  if (!import.meta.env.DEV) {
    const { env } = await import('cloudflare:workers');
    serviceBinding = (env as any).API;
  }
  return proxyApiRequest(request, apiPath, apiBase, serviceBinding);
};
