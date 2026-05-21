export * from './audit';

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    const result = JSON.parse(value);
    return result === null ? fallback : (result as T);
  } catch {
    return fallback;
  }
}
