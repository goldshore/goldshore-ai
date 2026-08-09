const PRIVATE_IPV4 = /^(?:127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
const INJECTION_MARKERS = [/ignore (?:all |any )?(?:previous|prior) instructions/i, /system\s*prompt/i, /developer\s*message/i, /reveal (?:your |the )?(?:secret|token|credential)/i, /<\/?(?:script|iframe|tool_call)/i];

export const MAX_CONNECTOR_RESPONSE_BYTES = 1_048_576;

export function assertSafeUrl(raw: string, allowedHosts: readonly string[]): URL {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || host === 'localhost' || host.endsWith('.local') || PRIVATE_IPV4.test(host) || !allowedHosts.includes(host)) {
    throw new Error('Connector URL rejected by SSRF policy');
  }
  return url;
}

export function validateInput(input: unknown, schema: Record<string, 'string' | 'number' | 'boolean' | 'object'>): asserts input is Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Connector input must be an object');
  const value = input as Record<string, unknown>;
  for (const [key, type] of Object.entries(schema)) {
    if (!(key in value) || typeof value[key] !== type || (type === 'object' && value[key] === null)) throw new Error(`Invalid connector input field: ${key}`);
  }
  for (const key of Object.keys(value)) if (!(key in schema)) throw new Error(`Unexpected connector input field: ${key}`);
}

export function assertNoPromptInjection(input: unknown): void {
  const serialized = JSON.stringify(input);
  if (serialized.length > 64_000) throw new Error('Connector input exceeds size limit');
  if (INJECTION_MARKERS.some((marker) => marker.test(serialized))) throw new Error('Potential prompt injection rejected');
}

export async function readBoundedJson(response: Response, maximum = MAX_CONNECTOR_RESPONSE_BYTES): Promise<unknown> {
  const declared = Number(response.headers.get('content-length') || '0');
  if (declared > maximum) throw new Error('Connector response exceeds size limit');
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) { await reader.cancel(); throw new Error('Connector response exceeds size limit'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return size ? JSON.parse(new TextDecoder().decode(bytes)) : null;
}
