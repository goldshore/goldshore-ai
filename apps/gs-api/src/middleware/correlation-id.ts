import type { Context, Next } from 'hono';
import type { Env, Variables } from '../types';

const CORRELATION_HEADER = 'x-correlation-id';

export function getCorrelationId(request: Request): string {
  const incoming = request.headers.get(CORRELATION_HEADER)?.trim();
  if (incoming) {
    return incoming.slice(0, 128);
  }
  return crypto.randomUUID();
}

export async function correlationIdMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
) {
  const correlationId = getCorrelationId(c.req.raw);
  c.set('correlationId', correlationId);

  await next();

  c.header(CORRELATION_HEADER, correlationId);
}
