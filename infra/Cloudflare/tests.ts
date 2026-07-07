// infra/Cloudflare/tests.ts
const ACCESS_PROTECTED_HOSTS = new Set([
  'admin.goldshore.ai',
  'admin.goldshore.org',
  'admin-preview.goldshore.ai',
  'gs-admin.pages.dev',
  'mcp.goldshore.ai',
  'ops.goldshore.ai',
  'trading.goldshore.ai',
  'dashboard.goldshore.ai',
  'dash.goldshore.ai',
]);

const ACCESS_PROTECTED_HOST_PATTERNS = [
  /^[a-z0-9-]+-preview\.goldshore\.ai$/i,
  /^[a-z0-9-]+\.goldshore-pages\.dev$/i,
];

function accessHeadersFor(url: string): Record<string, string> {
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;

  if (!clientId || !clientSecret) return {};

  const host = new URL(url).hostname;
  const isProtectedHost =
    ACCESS_PROTECTED_HOSTS.has(host) ||
    ACCESS_PROTECTED_HOST_PATTERNS.some((pattern) => pattern.test(host));

  if (!isProtectedHost) return {};

  return {
    'CF-Access-Client-Id': clientId,
    'CF-Access-Client-Secret': clientSecret,
  };
}

export async function smoke(url: string, expectStatus = 200, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = accessHeadersFor(url);
  const res = await fetch(url, { signal: ctrl.signal, headers }).catch(
    () => null,
  );
  clearTimeout(t);
  if (!res || res.status !== expectStatus)
    throw new Error(`Smoke fail ${url}: got ${res?.status}`);
}

export async function lighthouse(url: string, minScore = 0.8) {
  // Placeholder: ensure reachability; integrate real LH CI if desired.
  await smoke(url, 200, 8000);
}
