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
//
// IMPORTANT: fetchAdminJson below went live without ever forwarding the
// caller's Cf-Access-Jwt-Assertion header, so every page using it sent gs-api
// zero auth data and always got a 401 back — a bug that stacked underneath
// (and outlasted) the audience-mismatch fix in gs-api's own middleware. Any
// new caller of fetchAdminJson MUST pass Astro.request as the first
// argument, or it will silently repeat this exact failure.
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

// Several .astro pages fetch JSON server-side in their frontmatter, outside
// any pages/api/admin/* route — repo-health.astro, repo-health/findings.astro,
// entries/detail.astro, leads/detail.astro, and pii-scans.astro all did a raw
// `fetch(\`${apiUrl}/admin/...\`, { headers: { Authorization: \`Bearer
// ${Astro.cookies.get('auth_token')?.value}\` } })`. Two bugs stacked there:
// `auth_token` is not a cookie this app ever sets (admin auth is Cloudflare
// Access, not a bearer cookie), and the plain fetch defaults to
// `redirect: 'follow'`, so Access's login-page redirect gets silently
// followed and returns 200 OK HTML — `response.ok` is true, and the page
// crashes trying to `.json()` the HTML. This helper fetches through the same
// service binding as proxyApiRequest/proxyAdminRequest, which bypasses
// Access entirely for this internal hop, exactly like contact.ts.
export const fetchAdminJson = async <T = unknown>(
  request: Request,
  apiPath: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null }> => {
  // Forward the incoming request's own headers first — this is what actually
  // carries the visitor's Cf-Access-Jwt-Assertion header/cookie through to
  // gs-api. Losing this (as the original version of this function did) means
  // gs-api's Access verification always fails with 401, regardless of any
  // fix on gs-api's own side.
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('accept', 'application/json');
  if (init?.headers) {
    for (const [key, value] of Object.entries(init.headers as Record<string, string>)) {
      headers.set(key, value);
    }
  }
  let response: Response;

  if (!import.meta.env.DEV) {
    const { env } = await import('cloudflare:workers');
    const serviceBinding = (env as any).API as ServiceBinding;
    response = await serviceBinding.fetch(
      new Request(`http://api.internal${apiPath}`, { ...init, headers })
    );
  } else {
    const base = (import.meta.env.PUBLIC_API_URL || 'https://api.goldshore.ai').replace(/\/$/, '');
    response = await fetch(`${base}${apiPath}`, { ...init, headers });
  }

  if (!response.ok) {
    return { ok: false, status: response.status, data: null };
  }
  const data = (await response.json()) as T;
  return { ok: true, status: response.status, data };
};
