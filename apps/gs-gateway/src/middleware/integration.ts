import { type MiddlewareHandler } from 'hono';
import { type Env } from '../types';

const INTEGRATION_PATH_PREFIXES = ['/integrations', '/market-streams'];
const DATA_CLASSIFICATIONS = new Set(['public', 'internal', 'confidential', 'restricted']);
const SECRETS_ACCESS_POLICIES = new Set([
  'none',
  'read-only',
  'read-write',
  'broker-credentials',
  'market-data'
]);

const isIntegrationRequest = (path: string) =>
  INTEGRATION_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));

export const integrationControls: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (!isIntegrationRequest(c.req.path) || c.req.method === 'OPTIONS') {
    await next();
    return;
  }

  const classification = c.req.header('X-Data-Classification')?.toLowerCase();
  if (!classification || !DATA_CLASSIFICATIONS.has(classification)) {
    return c.json(
      {
        error: 'Invalid data classification.',
        allowed: Array.from(DATA_CLASSIFICATIONS)
      },
      400
    );
  }

  const secretsPolicy = c.req.header('X-Secrets-Access-Policy')?.toLowerCase();
  if (!secretsPolicy || !SECRETS_ACCESS_POLICIES.has(secretsPolicy)) {
    return c.json(
      {
        error: 'Invalid secrets access policy.',
        allowed: Array.from(SECRETS_ACCESS_POLICIES)
      },
      400
    );
  }

  const auditTraceId = c.req.header('X-Audit-Trace-Id')?.trim();
  if (!auditTraceId) {
    return c.json({ error: 'Missing audit trace id.' }, 400);
  }

  const auditEntry = {
    traceId: auditTraceId,
    classification,
    secretsPolicy,
    method: c.req.method,
    path: c.req.path,
    timestamp: new Date().toISOString(),
    cfRay: c.req.header('CF-Ray') ?? null,
    actor: c.req.header('CF-Access-User-Email') ?? 'unknown'
  };

  if (c.env.GATEWAY_KV) {
    await c.env.GATEWAY_KV.put(`audit:${auditTraceId}`, JSON.stringify(auditEntry), {
      expirationTtl: 60 * 60 * 24 * 30
    });
  } else {
    console.warn('GATEWAY_KV is not configured for audit logging.', auditEntry);
  }

  await next();
};
