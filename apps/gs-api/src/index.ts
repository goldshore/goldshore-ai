import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import {
  verifyAccessWithClaims,
  type AccessTokenPayload,
} from '@goldshore/auth';
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
import { getRuntimeVersion, withContractHeaders } from './routes/contract';
import { assertSecuritySecrets } from './securitySecrets';

type Env = {
  KV: KVNamespace;
  CONTROL_LOGS?: KVNamespace;
  CONTENT_DB: D1Database;
  TELEMETRY_DB?: D1Database;
  ASSETS: R2Bucket;
  AUTH_SESSION?: DurableObjectNamespace;
  AI: Ai;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  JWT_SECRET?: string;
  STRIPE_API_KEY?: string;
  SENDGRID_API_KEY?: string;
  ACCESS_CLIENT_SECRET?: string;
  // Sentinel: Added support for Audience verification to prevent auth bypass
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  // Sentinel: Added support for dynamic team domain
  CLOUDFLARE_TEAM_DOMAIN?: string;
  CONTROL_SYNC_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
  ENV?: string;
  API_VERSION?: string;
  DEPLOY_SHA?: string;
  GIT_SHA?: string;
};

const app = new Hono<{
  Bindings: Env;
  Variables: { accessClaims: AccessTokenPayload | null };
}>();

const requiredBindings = ['CONTENT_DB', 'ASSETS', 'AI'] as const;
const expectedD1Binding = 'CONTENT_DB' as const;
const requiredSecrets = [
  'JWT_SECRET',
  'STRIPE_API_KEY',
  'SENDGRID_API_KEY',
  'ACCESS_CLIENT_SECRET',
] as const;

const DEFAULT_ALLOWED_ORIGINS = [
  'https://goldshore.ai',
  'https://www.goldshore.ai',
  'https://admin.goldshore.ai',
  'https://ops.goldshore.ai',
  'https://admin-preview.goldshore.ai',
  'https://preview.goldshore.ai',
];

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

const isLocalDevelopmentOrigin = (origin: string) => {
  return (
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1')
  );
};

const isPublicPath = (path: string, method: string) => {
  if (method === 'OPTIONS') {
    return true;
  }

  return (
    path === '/' ||
    path === '/version' ||
    path === '/health' ||
    path.startsWith('/health/')
  );
};

// Sentinel: Security Middleware
app.use('*', secureHeaders());

// Runtime safety guard (fail-fast for misconfigured production runtime).
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

// Enforce CORS to allow legitimate browser clients
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) {
        return null;
      }

      if (c.env.ENV !== 'production' && isLocalDevelopmentOrigin(origin)) {
        return origin;
      }

      return isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS) ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion'],
    exposeHeaders: ['Content-Length'],
    credentials: true,
    maxAge: 600,
  }),
);

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

  if (!c.env.CLOUDFLARE_ACCESS_AUDIENCE) {
    return c.json(
      { error: 'Cloudflare Access audience is not configured for protected routes.' },
      503,
    );
  }

  // Verify Cloudflare Access JWT
  const claims = await verifyAccessWithClaims(c.req.raw, c.env);
  if (!claims) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('accessClaims', claims);
  await next();
});

// Root API Info Page
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
        <p>Core Services & Intelligence</p>
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
      getRuntimeVersion(c.env)
    )
  );
});

// Core routes
app.route('/health', health);
app.route('/ai', ai);
app.route('/users', users);
app.route('/user', user);
app.route('/system', system);
app.route('/templates', templates);
app.route('/admin', admin);
app.route('/media', media);
app.route('/pages', pages);
app.route('/internal', internal);

// V1 Routes
const v1 = new Hono<{ Bindings: Env }>();

v1.route('/users', users);
// Placeholder routes removed — v1/agents, v1/models, and v1/logs
// returned hardcoded fake data. Implement with real handlers when needed.

app.route('/v1', v1);

export { isAllowedOrigin, isPreviewOrigin, parseAllowedOrigins };

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

export default app;
