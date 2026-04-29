// infra/cf/tests.ts
export async function smoke(url: string, expectStatus = 200, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const res = await fetch(url, { signal: ctrl.signal }).catch(() => null);
  clearTimeout(t);
  if (!res || res.status !== expectStatus) throw new Error(`Smoke fail ${url}: got ${res?.status}`);
}

export async function lighthouse(url: string, minScore = 0.8) {
  // Placeholder: ensure reachability; integrate real LH CI if desired.
  await smoke(url, 200, 8000);
}
