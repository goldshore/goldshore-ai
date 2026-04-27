import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { verifyAccessWithClaims, type AccessTokenPayload } from '@goldshore/auth';
import users from './routes/users';
import health from './routes/health';
import ai from './routes/ai';
import user from './routes/user';
import system from './routes/system';
import templates from './routes/templates';
import admin from './routes/admin';
import media from './routes/media';
import pages from './routes/pages';

type Env = {
  KV: KVNamespace;
  DB: D1Database;
  ASSETS: R2Bucket;
  AI: any;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  // Sentinel: Added support for Audience verification to prevent auth bypass
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  // Sentinel: Added support for dynamic team domain
  CLOUDFLARE_TEAM_DOMAIN?: string;
};

const app = new Hono<{ Bindings: Env; Variables: { accessClaims: AccessTokenPayload | null } }>();

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?goldshore\.ai$/,
  /^https:\/\/([a-z0-9-]+\.)+goldshore\.ai$/,
  /^https:\/\/([a-z0-9-]+\.)+goldshore-pages\.dev$/,
  /^http:\/\/localhost(:\d+)?$/
];

const isAllowedOrigin = (origin: string) => {
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
};

// Sentinel: Security Middleware
app.use('*', secureHeaders());

// Enforce CORS to allow legitimate browser clients
app.use('*', cors({
  origin: (origin) => (isAllowedOrigin(origin) ? origin : 'https://goldshore.ai'),
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion'],
  exposeHeaders: ['Content-Length'],
  credentials: true,
  maxAge: 600,
}));

// Enforce Authentication (Defense in Depth)
app.use('*', async (c, next) => {
  // Allow health checks, root, and CORS preflight
  if (c.req.path === '/health' || c.req.path.startsWith('/health/') || c.req.path === '/' || c.req.method === 'OPTIONS') {
    c.set('accessClaims', null);
    await next();
    return;
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

// V1 Routes
const v1 = new Hono<{ Bindings: Env }>();

v1.route('/users', users);
v1.get('/agents', (c) => c.json({ agents: ['agent-alpha', 'agent-beta'] }));
v1.get('/models', (c) => c.json({ models: ['gpt-4', 'claude-3'] }));
v1.get('/logs', (c) => c.json({ logs: ['log1', 'log2'] }));

app.route('/v1', v1);

export default app;
