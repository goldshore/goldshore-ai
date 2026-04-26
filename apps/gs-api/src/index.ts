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

type Env = {
  KV: KVNamespace;
  CONTROL_LOGS?: KVNamespace;
  DB: D1Database;
  ASSETS: R2Bucket;
  AI: Ai;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  // Sentinel: Added support for Audience verification to prevent auth bypass
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  // Sentinel: Added support for dynamic team domain
  CLOUDFLARE_TEAM_DOMAIN?: string;
  CONTROL_SYNC_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
  ENV?: string;
};

const app = new Hono<{
  Bindings: Env;
  Variables: { accessClaims: AccessTokenPayload | null };
}>();

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

// Sentinel: Security Middleware
app.use('*', secureHeaders());

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
  // Allow health checks, root, and CORS preflight
  if (
    c.req.path === '/health' ||
    c.req.path.startsWith('/health/') ||
    c.req.path === '/' ||
    c.req.method === 'OPTIONS'
  ) {
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
export default app;
