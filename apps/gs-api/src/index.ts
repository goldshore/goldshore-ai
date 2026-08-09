import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import {
  verifyAccessWithClaims,
  authorizeAccessClaims,
} from '@goldshore/auth';
import { createCorsMiddleware, APPROVED_API_ORIGINS } from '@goldshore/shared';
import { EmailLogSchema } from '@goldshore/schema';
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
import products from './routes/products';
import domains from './routes/domains';
import sites from './routes/sites';
import forms from './routes/forms';
import deployments from './routes/deployments';
import gearswipe from './routes/gearswipe';
import services from './routes/services';
import agent from './routes/agent';
import control from './routes/control';
import core from './routes/core';
import mail from './routes/mail';
import trading from './routes/trading';
import googleBusiness from './routes/google-business';
import { getRuntimeVersion, withContractHeaders } from './routes/contract';
import { assertSecuritySecrets } from './securitySecrets';

type Env = {
  KV: KVNamespace;
  CONTROL_LOGS?: KVNamespace;
  RISK_RADAR_CACHE?: KVNamespace;
  PLATFORM_DB: D1Database;
  TELEMETRY_DB?: D1Database;
  GS_ASSETS: R2Bucket;
  AI: Ai;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  JWT_SECRET?: string;
  STRIPE_API_KEY?: string;
  SENDGRID_API_KEY?: string;
  ACCESS_CLIENT_SECRET?: string;
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  CONTROL_SYNC_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
  ENV?: string;
  API_VERSION?: string;
  DEPLOY_SHA?: string;
  GIT_SHA?: string;
  MAIL_BLOCKED_SENDERS?: string;
  MAIL_ALLOWED_RECIPIENTS?: string;
  MAIL_FORWARD_TO?: string;
  FORWARD_TO?: string;
};
import type { Env, Variables } from './types';
import { getHostRoutePrefix } from './host-routing';
import { handleTokenRotation } from './workers/token-rotation';
import { processQueueBatch } from './workers/queue-consumer';
export { SignalsEvaluator } from './workers/signals-evaluator';

interface ForwardableEmailMessage {
  from: string;
  to: string;
  headers: Headers;
  setReject(reason: string): void;
  forward(to: string): Promise<void>;
}

type ExecutionContext = {
  waitUntil(promise: Promise<void>): void;
};

const app = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

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
  if (method === 'POST' && /^\/v1\/forms\/[a-z0-9-]+\/submissions$/i.test(path)) return true;
  return (
    path === '/' ||
    path === '/version' ||
    path === '/health' ||
    path.startsWith('/health/') ||
    /^\/(agent|mail|control|trading|core)\/health\/?$/.test(path) ||
    (method === 'GET' && path === '/admin/google/oauth/callback') ||
    (method === 'POST' && path === '/mail/contact')
  );
};

app.use('*', secureHeaders());

const SAFE_PREVIEW_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PREVIEW_GET_MUTATION_PATHS = [/\/oauth(?:\/|$)/i];

app.use('*', async (c, next) => {
  if (
    c.env.ENV === 'preview' &&
    c.env.STATE_MUTATIONS_ENABLED !== 'true' &&
    (!SAFE_PREVIEW_METHODS.has(c.req.method.toUpperCase()) ||
      PREVIEW_GET_MUTATION_PATHS.some((pattern) => pattern.test(c.req.path)))
  ) {
    return c.json(
      { error: 'Preview state mutations are disabled until isolated resources are provisioned.' },
      503,
    );
  }

  await next();
});

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
  await next();
  const runtimeVersion = getRuntimeVersion(c.env);
  const deploySha = c.env.DEPLOY_SHA ?? c.env.GIT_SHA ?? c.env.CF_VERSION_METADATA?.id;
  c.header('X-GS-API-Version', runtimeVersion);
  if (deploySha) c.header('X-GS-Deploy-SHA', deploySha);
});

app.use('*', async (c, next) => {
  const routePrefix = getHostRoutePrefix(c.req.raw);
  if (!routePrefix || c.req.path === routePrefix || c.req.path.startsWith(`${routePrefix}/`)) {
    await next();
    return;
  }

  const routedUrl = new URL(c.req.url);
  routedUrl.pathname = `${routePrefix}${routedUrl.pathname === '/' ? '' : routedUrl.pathname}`;
  return app.fetch(new Request(routedUrl.toString(), c.req.raw), c.env);
});

// Enforce Authentication (Defense in Depth)
app.use('*', async (c, next) => {
  if (isPublicPath(c.req.path, c.req.method)) {
    c.set('accessClaims', null);
    await next();
    return;
  }

  const serviceRequest = c.req.path === '/internal' || c.req.path.startsWith('/internal/');
  const accessEnv = serviceRequest
    ? {
        ...c.env,
        CLOUDFLARE_ACCESS_AUDIENCE: c.env.CLOUDFLARE_SERVICE_ACCESS_AUDIENCE,
        CLOUDFLARE_ACCESS_APPLICATION: 'service-production',
      }
    : c.env;
  if (!accessEnv.CLOUDFLARE_ACCESS_AUDIENCE) {
    return c.json(
      { error: 'Cloudflare Access audience is not configured for protected routes.' },
      503,
    );
  }

  const verifiedClaims = await verifyAccessWithClaims(c.req.raw, accessEnv);
  const claims = verifiedClaims
    ? await authorizeAccessClaims(verifiedClaims, accessEnv)
    : null;
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
app.route('/admin/google', googleBusiness);
app.route('/media', media);
app.route('/pages', pages);
app.route('/internal', internal);
app.route('/products', products);
app.route('/services', services);
// Host aliases are rewritten into these shared route modules above. They do
// not own independent authentication, CORS, or security middleware stacks.
app.route('/agent', agent);
app.route('/mail', mail);
app.route('/control', control);
app.route('/trading', trading);
app.route('/core', core);

const v1 = new Hono<{ Bindings: Env }>();
v1.route('/users', users);
v1.route('/domains', domains);
v1.route('/sites', sites);
v1.route('/forms', forms);
v1.route('/deployments', deployments);
v1.route('/gearswipe', gearswipe);
v1.route('/services', services);
v1.get('/leads', (c) => c.json({ leads: [] }));

app.route('/v1', v1);

export { isAllowedOrigin, isPreviewOrigin, isPublicPath, parseAllowedOrigins };

type DurableObjectState = {
  id: { toString(): string };
};

const normalizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

const parseEmailList = (list?: string): string[] => {
  if (!list) return [];
  return list
    .split(/[,;\s]+/)
    .map((email) => normalizeEmail(email))
    .filter((email) => email.length > 0);
};

const isEmailLike = (email: string): boolean => {
  // Simple email validation: must contain @ and at least one dot after @
  // Avoids ReDoS vulnerability from backtracking in complex quantifier patterns
  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex === email.length - 1) return false;
  const afterAt = email.substring(atIndex + 1);
  return afterAt.includes('.') && !afterAt.endsWith('.');
};

const readInboxLogs = async (kv: KVNamespace) => {
  try {
    const stored = await kv.get('EMAIL_INBOX_LOGS');
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

interface Message<T> {
  id: string;
  body: T;
  ack(): void;
  retry(): void;
}

interface MessageBatch<T> {
  messages: Array<Message<T>>;
}

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    await processQueueBatch(batch, env);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === '0 2 * * *') {
      ctx.waitUntil(handleTokenRotation(env));
    }
  },

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
