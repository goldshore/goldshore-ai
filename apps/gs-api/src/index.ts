import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import {
  verifyAccessWithClaims,
  authorizeAccessClaims,
} from '@goldshore/auth';
import { createCorsMiddleware, APPROVED_API_ORIGINS } from '@goldshore/shared';
import users from './routes/users';
import health from './routes/health';
import ai from './routes/ai';
import user from './routes/user';
import system from './routes/system';
import templates from './routes/templates';
import admin from './routes/admin';
import mcp from './routes/mcp';
import media from './routes/media';
import pages from './routes/pages';
import internal from './routes/internal';
import integrations from './routes/integrations';
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
import googleWorkspace from './routes/google-workspace';
import oauth from './routes/oauth';
import webhooks from './routes/webhooks';
import automation from './routes/automation';
// TODO: Resolve Wrangler module resolution issue with @goldshore packages before re-enabling
import subscriptions from './routes/subscriptions';
import { getRuntimeVersion, withContractHeaders } from './routes/contract';
import { assertSecuritySecrets } from './securitySecrets';
import { ssrfProtectionMiddleware } from './middleware/ssrf-protection';
import type { Env, Variables } from './types';
import agent from './routes/agent';
import mail from './routes/mail';
import control from './routes/control';
import trading from './routes/trading';
import core from './routes/core';
import { getHostRoutePrefix } from './host-routing';
import { handleTokenRotation } from './workers/token-rotation';
import { processQueueBatch } from './workers/queue-consumer';
import { syncGoogleWorkspaceRbac } from './lib/google-workspace-rbac';
import { archiveInboundEmail } from './lib/inbound-mail';
import { dependencyDetailsHandler, readinessHandler } from './routes/health';
export { SignalsEvaluator } from './workers/signals-evaluator';

type ExecutionContext = {
  waitUntil(promise: Promise<void>): void;
};

const app = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const DEFAULT_ALLOWED_ORIGINS = [...APPROVED_API_ORIGINS];

const parseAllowedOrigins = (allowedOrigins?: string) => {
  return (allowedOrigins ? allowedOrigins.split(',') : DEFAULT_ALLOWED_ORIGINS)
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const isPreviewOrigin = (origin: string) => {
  return /^https:\/\/[a-z0-9-]+-gs-(?:api|web)-prod\.goldshore\.workers\.dev$/i.test(origin);
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
    path === '/ready' ||
    path === '/health' ||
    path.startsWith('/health/') ||
    (method === 'POST' && /^\/v1\/forms\/[^/]+\/submissions$/.test(path)) ||
    // Per-service health probes (/agent/health, /mail/health, …) are not
    // covered by the /health/ prefix check above.
    /^\/(agent|mail|control|trading|core)\/health\/?$/.test(path) ||
    (method === 'GET' && path === '/admin/google/oauth/callback') ||
    (method === 'GET' && /^\/auth\/github\/(?:login|callback)$/.test(path)) ||
    (method === 'POST' && /^\/webhooks\/github\/(?:push|pull_request|issues|workflow_run)$/.test(path)) ||
    path === '/mail/contact'
  );
};

app.use('*', secureHeaders());

app.use('*', async (c, next) => {
  const requestId = c.req.header('cf-ray') || crypto.randomUUID();
  const startedAt = Date.now();
  c.set('requestId', requestId);
  try {
    await next();
  } finally {
    c.header('X-Request-ID', requestId);
    console.info({
      event: 'http_request',
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - startedAt,
    });
  }
});

const SAFE_PREVIEW_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PREVIEW_GET_MUTATION_PATHS = [/\/oauth(?:\/|$)/i];

app.use('*', async (c, next) => {
  if (
    new URL(c.req.url).hostname.endsWith('.workers.dev') &&
    (!SAFE_PREVIEW_METHODS.has(c.req.method.toUpperCase()) ||
      PREVIEW_GET_MUTATION_PATHS.some((pattern) => pattern.test(c.req.path)))
  ) {
    return c.json(
      { error: 'Version previews are read-only.', requestId: c.get('requestId') },
      403,
    );
  }

  await next();
});

app.use(
  '*',
  createCorsMiddleware({
    allowLocalhost: true,
  }),
);

// Ensure CORS headers are applied to all error responses (401, 403, etc)
app.use('*', async (c, next) => {
  await next();
  // If CORS headers weren't set by previous middleware, add them for admin/protected routes
  if (!c.res.headers.get('Access-Control-Allow-Origin')) {
    const origin = c.req.header('Origin');
    if (origin && (origin.includes('goldshore.*') || origin.includes('localhost'))) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Goldshore-Client, X-Goldshore-Request-Id, CF-Access-Jwt-Assertion');
      c.header('Access-Control-Allow-Credentials', 'true');
    }
  }
});

app.use('/v1/*', ssrfProtectionMiddleware);

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
  const adminProxyRequest = c.req.path.startsWith('/api/admin') || c.req.path.startsWith('/admin/');

  const accessEnv = serviceRequest
    ? {
        ...c.env,
        CLOUDFLARE_ACCESS_AUDIENCE: c.env.CLOUDFLARE_SERVICE_ACCESS_AUDIENCE,
        CLOUDFLARE_ACCESS_APPLICATION: 'service-production',
      }
    : adminProxyRequest
    ? {
        ...c.env,
        // Accept admin-production audience for proxied requests from gs-web
        CLOUDFLARE_ACCESS_AUDIENCE: c.env.ADMIN_PROXY_AUDIENCE || c.env.CLOUDFLARE_ACCESS_AUDIENCE,
      }
    : c.env;
  if (!accessEnv.CLOUDFLARE_ACCESS_AUDIENCE) {
    return c.json(
      { error: 'Cloudflare Access audience is not configured for protected routes.' },
      503,
    );
  }

  // Try CF Access JWT first, then fall back to Bearer token from Authorization header
  let verifiedClaims = await verifyAccessWithClaims(c.req.raw, accessEnv);

  // For admin proxy requests, also accept Bearer tokens (CF_Authorization from frontend)
  if (!verifiedClaims && adminProxyRequest) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7); // Remove 'Bearer ' prefix
      try {
        // Treat bearer token as a direct CF Access JWT
        const response = new Request(c.req.url, {
          headers: new Headers({
            'CF-Access-JWT-Assertion': token,
          }),
        });
        verifiedClaims = await verifyAccessWithClaims(response, accessEnv);
      } catch (error) {
        console.warn('[auth] Bearer token verification failed:', error instanceof Error ? error.message : String(error));
      }
    }
  }

  const claims = verifiedClaims
    ? await authorizeAccessClaims(verifiedClaims, accessEnv)
    : null;
  if (!claims) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('accessClaims', claims);
  await next();
});

type CapabilityBinding = 'KV' | 'PLATFORM_DB' | 'GS_ASSETS' | 'AI' | 'MAIL_JOBS_QUEUE';

const requiredRouteBindings = (path: string): CapabilityBinding[] => {
  if (path.startsWith('/media')) return ['PLATFORM_DB', 'GS_ASSETS'];
  if (path.startsWith('/ai') || path.startsWith('/agent')) return ['KV', 'AI'];
  if (path.startsWith('/mail/contact')) return ['PLATFORM_DB', 'MAIL_JOBS_QUEUE'];
  if (path.startsWith('/mail/inbox')) return ['PLATFORM_DB'];
  if (path.startsWith('/v1/forms')) return ['PLATFORM_DB', 'MAIL_JOBS_QUEUE'];
  if (/^\/(?:users?|pages|services|admin)(?:\/|$)/.test(path)) return ['PLATFORM_DB'];
  if (/^\/(?:system|internal|products|auth|oauth|webhooks)(?:\/|$)/.test(path)) return ['KV'];
  return [];
};

app.use('*', async (c, next) => {
  const missing = requiredRouteBindings(c.req.path).filter((binding) => !c.env[binding]);
  if (missing.length > 0) {
    console.error({
      event: 'route_capability_missing',
      requestId: c.get('requestId'),
      path: c.req.path,
      missing,
    });
    return c.json(
      { error: 'Service dependency unavailable.', requestId: c.get('requestId') },
      503,
    );
  }
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

app.get('/ready', readinessHandler);
app.route('/health', health);
app.route('/ai', ai);
app.route('/users', users);
app.route('/user', user);
app.route('/system', system);
app.route('/templates', templates);
app.get('/admin/system/dependencies', dependencyDetailsHandler);
app.route('/admin', admin);
app.route('/admin/automation', automation);
app.route('/admin/google', googleBusiness);
app.route('/admin/workspace', googleWorkspace);
app.route('/auth', oauth);
app.route('/oauth', oauth);
// TODO: Re-enable once module resolution issue is fixed
app.route('/subscriptions', subscriptions);
app.route('/webhooks', webhooks);
app.route('/media', media);
app.route('/pages', pages);
app.route('/internal', internal);
app.route('/integrations', integrations);
app.route('/products', products);
app.route('/services', services);
// Host aliases are rewritten into these shared route modules above. They do
// not own independent authentication, CORS, or security middleware stacks.
app.route('/agent', agent);
app.route('/mail', mail);
app.route('/control', control);
app.route('/trading', trading);
app.route('/core', core);
app.route('/mcp', mcp);

const v1 = new Hono<{ Bindings: Env; Variables: Variables }>();
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

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    await processQueueBatch(batch, env);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === '0 2 * * *') {
      ctx.waitUntil(
        Promise.all([
          handleTokenRotation(env),
          syncGoogleWorkspaceRbac(env)
            .then((result) => {
              console.info({ event: 'google_workspace_sync_complete', ...result });
            })
            .catch((error) => {
              console.error({ event: 'google_workspace_sync_error', error: String(error) });
            }),
        ]).then(() => undefined),
      );
    }
  },

  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    const sender = message.from;
    const recipient = message.to;
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

    const forwardTo = (env.MAIL_FORWARD_TO || env.FORWARD_TO)?.trim();
    if (!forwardTo || !isEmailLike(forwardTo)) {
      message.setReject('Mail forwarding is not configured.');
      return;
    }

    let archivedMessageId: string | undefined;
    try {
      const archived = await archiveInboundEmail(message, env);
      archivedMessageId = archived.id;
      console.info({ event: 'inbound_mail_archived', ...archived });
    } catch (error) {
      console.error({ event: 'inbound_mail_archive_failed', error: String(error) });
    }

    try {
      await message.forward(normalizeEmail(forwardTo));
      if (archivedMessageId) {
        await env.PLATFORM_DB.prepare(
          `UPDATE inbound_messages SET status = 'forwarded' WHERE id = ?`,
        ).bind(archivedMessageId).run();
      }
    } catch (error) {
      if (archivedMessageId) {
        await env.PLATFORM_DB.prepare(
          `UPDATE inbound_messages SET status = 'failed' WHERE id = ?`,
        ).bind(archivedMessageId).run().catch(() => undefined);
      }
      throw error;
    }
  },
};

app.onError((error, c) => {
  const requestId = c.get('requestId') || crypto.randomUUID();
  console.error({ event: 'unhandled_error', requestId, error: String(error) });
  return c.json({ error: 'Internal server error.', requestId }, 500);
});
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
