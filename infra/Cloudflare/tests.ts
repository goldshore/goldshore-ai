// infra/Cloudflare/tests.ts
const ACCESS_PROTECTED_HOSTS = new Set([
  'admin.goldshore.ai',
  'gs-admin.pages.dev',
  'ops.goldshore.ai',
]);

function accessHeadersFor(url: string): Record<string, string> {
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;

  if (!clientId || !clientSecret) return {};

  const host = new URL(url).hostname;
  if (!ACCESS_PROTECTED_HOSTS.has(host)) return {};

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
