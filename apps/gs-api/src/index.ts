// @ts-nocheck
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import {
  verifyAccessWithClaims,
  type AccessTokenPayload,
} from '@goldshore/auth';
import { createCorsMiddleware, APPROVED_API_ORIGINS } from '@goldshore/shared';
import users from './routes/users';
import health from './routes/health';
import ai from './routes/ai';
import user from './routes/user';
import system from './routes/system';
import templates from './routes/templates';
import admin from './routes/admin';
import media from './routes/media';
import pages from './routes/pages';
import internal from './routes/internal';
import { EmailInboxLogsSchema, EmailLogSchema, type EmailLog } from '@goldshore/schema';
import domains from './routes/domains';
import sites from './routes/sites';
import forms from './routes/forms';
import deployments from './routes/deployments';
import gearswipe from './routes/gearswipe';
import crawler from './routes/crawler';
import integrations from './routes/integrations';
import { getRuntimeVersion, withContractHeaders } from './routes/contract';
import { assertSecuritySecrets } from './securitySecrets';
import { type Env } from './types';

const app = new Hono<{
  Bindings: Env;
  Variables: { accessClaims: AccessTokenPayload | null };
}>();

const TRACE_HEADER = 'X-Correlation-Id';
const AGENT_HOSTNAME = 'agent.goldshore.ai';

const getCorrelationId = (request: Request): string =>
  request.headers.get(TRACE_HEADER) ?? crypto.randomUUID();

const withCorrelationId = (response: Response, correlationId: string): Response => {
  const headers = new Headers(response.headers);
  headers.set(TRACE_HEADER, correlationId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const isAgentHostnameRequest = (request: Request): boolean =>
  new URL(request.url).hostname === AGENT_HOSTNAME;

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const parseEmailList = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeEmail);

const isEmailLike = (value: string) => {
  const normalized = normalizeEmail(value);
  const atIndex = normalized.indexOf('@');
  const lastDotIndex = normalized.lastIndexOf('.');

  return atIndex > 0 && lastDotIndex > atIndex + 1 && lastDotIndex < normalized.length - 1;
};

const readInboxLogs = async (kv: KVNamespace): Promise<EmailLog[]> => {
  const rawLogs = await kv.get('EMAIL_INBOX_LOGS', 'text');
  if (!rawLogs) return [];

  try {
    const parsedLogs = JSON.parse(rawLogs);
    const parseResult = EmailInboxLogsSchema.safeParse(parsedLogs);
    return parseResult.success ? parseResult.data : [];
  } catch (error) {
    console.error('Failed to parse EMAIL_INBOX_LOGS payload:', error);
    return [];
  }
};


const requiredBindings = ['PLATFORM_DB', 'GS_ASSETS', 'AI'] as const;
const expectedD1Binding = 'PLATFORM_DB' as const;
const requiredSecrets = [
  'JWT_SECRET',
  'STRIPE_API_KEY',
  'SENDGRID_API_KEY',
  'ACCESS_CLIENT_SECRET',
] as const;

const DEFAULT_ALLOWED_ORIGINS = [...APPROVED_API_ORIGINS];

const PREVIEW_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+-preview\.goldshore\.ai$/i,
  /^https:\/\/[a-z0-9-]+\.goldshore-pages\.dev$/i,
];

const parseAllowedOrigins = (allowedOrigins?: string) => {
  return (allowedOrigins ? allowedOrigins.split(',') : DEFAULT_ALLOWED_ORIGINS)
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const isPreviewOrigin = (origin: string) => {
  return PREVIEW_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
};

const isAllowedOrigin = (origin: string, allowedOrigins?: string) => {
  const configuredOrigins = parseAllowedOrigins(allowedOrigins);
  return configuredOrigins.includes(origin) || isPreviewOrigin(origin);
};

const isPublicPath = (path: string, method: string) => {
  if (method === 'OPTIONS') return true;
  return (
    path === '/' ||
    path === '/version' ||
    path === '/health' ||
    path.startsWith('/health/')
  );
};

app.use('*', secureHeaders());

app.use('*', async (c, next) => {
  if (c.env.ENV === 'production') {
    assertSecuritySecrets(c.env as Record<string, unknown>, c.env.ENV);
  }
  if (!c.env[expectedD1Binding]) {
    throw new Error(
      `CRITICAL_MISSING_D1_BINDING: Expected D1 binding "${expectedD1Binding}" is undefined. Verify [[d1_databases]] binding in wrangler.toml.`,
    );
  }
  for (const key of [...requiredBindings, ...requiredSecrets]) {
    if (!c.env[key]) {
      throw new Error(`CRITICAL_MISSING: ${key}. Terminating.`);
    }
  }
  await next();
});

app.use(
  '*',
  createCorsMiddleware({
    allowLocalhost: true,
  }),
);

app.use('*', async (c, next) => {
  if (!isAgentHostnameRequest(c.req.raw)) {
    await next();
    return;
  }

  const correlationId = getCorrelationId(c.req.raw);
  if (!c.env.AGENT) {
    return c.json({ error: 'Downstream agent not configured', traceId: correlationId }, 503, {
      [TRACE_HEADER]: correlationId,
    });
  }

  const downstreamRequest = new Request(c.req.raw, {
    headers: new Headers(c.req.raw.headers),
  });
  downstreamRequest.headers.set(TRACE_HEADER, correlationId);
  const response = await c.env.AGENT.fetch(downstreamRequest);
  return withCorrelationId(response, correlationId);
});

// Enforce Authentication (Defense in Depth)
app.use('*', async (c, next) => {
  if (isPublicPath(c.req.path, c.req.method)) {
    c.set('accessClaims', null);
    await next();
    return;
  }

  if (c.req.path === '/internal/sync-runs' && c.req.method === 'POST') {
    const controlToken = c.req.header('x-control-sync-token');
    if (
      controlToken &&
      c.env.CONTROL_SYNC_TOKEN &&
      controlToken === c.env.CONTROL_SYNC_TOKEN
    ) {
      c.set('accessClaims', null);
      await next();
      return;
    }
  }

  if (c.env.DEV_AUTH_BYPASS === '1') {
    c.set('accessClaims', {
      email: 'developer@goldshore.ai',
      roles: ['admin'],
    } as AccessTokenPayload);
    await next();
    return;
  }

  if (!c.env.CLOUDFLARE_ACCESS_AUDIENCE) {
    return c.json(
      { error: 'Cloudflare Access audience is not configured for protected routes.' },
      503,
    );
  }


  const claims = await verifyAccessWithClaims(c.req.raw, c.env);
  if (!claims) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('accessClaims', claims);
  await next();
});

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>GoldShore API</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { text-align: center; border: 1px solid #334155; padding: 2rem; border-radius: 8px; background: #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        h1 { margin-bottom: 0.5rem; color: #a78bfa; }
        p { color: #94a3b8; }
        .status { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; background: #7c3aed; color: #fff; font-size: 0.875rem; font-weight: 600; margin-top: 1rem; }
        code { background: #334155; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>GoldShore API</h1>
        <p>Core Services &amp; Intelligence</p>
        <div class="status">ONLINE</div>
        <p style="margin-top: 1rem; font-size: 0.9rem;">
          Docs available at <a href="https://goldshore.ai/developer" style="color: #a78bfa;">goldshore.ai/developer</a>
        </p>
      </div>
    </body>
    </html>
  `);
});

const PUBLIC_VERSION_CORS_ORIGINS = new Set([
  'https://goldshore.org',
  'https://www.goldshore.org',
]);

app.get('/version', (c) => {
  const origin = c.req.header('Origin');
  if (origin && PUBLIC_VERSION_CORS_ORIGINS.has(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Vary', 'Origin');
  }
  return c.json(
    withContractHeaders(
      {
        service: 'gs-api',
        version: c.env.API_VERSION ?? c.env.GIT_SHA ?? 'unknown',
        deploySha: c.env.DEPLOY_SHA ?? c.env.GIT_SHA ?? null,
      },
      getRuntimeVersion(c.env),
    ),
  );
});

app.get('/version.json', (c) =>
  c.json({
    service: 'gs-api',
    commit: c.env.GIT_SHA ?? c.env.DEPLOY_SHA ?? 'unknown',
    deployedAt: new Date().toISOString(),
    environment: c.env.ENV ?? 'production',
  }),
);

app.route('/health', health);
app.route('/ai', ai);
app.route('/users', users);
app.route('/user', user);
app.route('/system', system);
app.route('/templates', templates);
app.route('/admin', admin);
app.route('/admin/crawler', crawler);
app.route('/integrations', integrations);
app.route('/media', media);
app.route('/pages', pages);
app.route('/internal', internal);

app.all('/api/*', async (c) => {
  const correlationId = getCorrelationId(c.req.raw);
  const url = new URL(c.req.url);
  const proxiedPath = url.pathname.replace(/^\/api/, '') || '/';

  try {
    if (c.env.API_ORIGIN) {
      const targetUrl = new URL(proxiedPath + url.search, c.env.API_ORIGIN);
      const response = await fetch(targetUrl.toString(), c.req.raw);
      return withCorrelationId(response, correlationId);
    }

    const internalUrl = new URL(c.req.url);
    internalUrl.pathname = proxiedPath;
    const response = await app.fetch(new Request(internalUrl.toString(), c.req.raw), c.env, c.executionCtx);
    return withCorrelationId(response, correlationId);
  } catch (error) {
    console.error(`[api] gateway proxy failed; trace=${correlationId}`, error);
    return c.json({ error: 'Upstream request failed', traceId: correlationId }, 502, {
      [TRACE_HEADER]: correlationId,
    });
  }
});

// V1 Routes
const v1 = new Hono<{ Bindings: Env }>();
v1.route('/users', users);
v1.route('/domains', domains);
v1.route('/sites', sites);
v1.route('/forms', forms);
v1.route('/deployments', deployments);
v1.route('/gearswipe', gearswipe);
v1.get('/leads', (c) => c.json({ leads: [] }));

app.route('/v1', v1);

export { isAllowedOrigin, isPreviewOrigin, parseAllowedOrigins };

export default {
  fetch: app.fetch,

  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    const sender = message.from;
    const recipient = message.to;
    const subject = (message.headers.get('subject') || 'No Subject').slice(0, 50);

    const normalizedSender = normalizeEmail(sender);
    const normalizedRecipient = normalizeEmail(recipient);
    const blocked = parseEmailList(env.MAIL_BLOCKED_SENDERS);
    if (blocked.includes(normalizedSender)) {
      message.setReject(`Sender ${sender} is blocked.`);
      return;
    }

    const allowed = parseEmailList(env.MAIL_ALLOWED_RECIPIENTS);
    if (allowed.length > 0 && !allowed.includes(normalizedRecipient)) {
      message.setReject(`Recipient ${recipient} is not allowlisted.`);
      return;
    }

    const parsedEntry = EmailLogSchema.safeParse({
      id: crypto.randomUUID(),
      from: sender,
      to: recipient,
      subject,
      timestamp: new Date().toISOString(),
    });

    if (parsedEntry.success) {
      ctx.waitUntil((async () => {
        const existingLogs = await readInboxLogs(env.KV);
        const updatedLogs = [parsedEntry.data, ...existingLogs].slice(0, 100);
        await env.KV.put('EMAIL_INBOX_LOGS', JSON.stringify(updatedLogs));
      })());
    }

    const forwardTo = (env.MAIL_FORWARD_TO || env.FORWARD_TO)?.trim();
    if (!forwardTo || !isEmailLike(forwardTo)) {
      message.setReject('Mail forwarding is not configured.');
      return;
    }

    await message.forward(normalizeEmail(forwardTo));
  },
};
export class AuthSession {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(): Promise<Response> {
    return new Response(
      JSON.stringify({
        ok: true,
        id: this.state.id.toString(),
        env: this.env.ENV ?? 'unknown',
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  }
}
