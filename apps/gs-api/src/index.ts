import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { health } from './routes/health';
import { user } from './routes/user';
import { system } from './routes/system';
import { pages } from './routes/pages';
import { media } from './routes/media';

type Env = {
  KV: KVNamespace;
  CONTROL_LOGS?: KVNamespace;
  DB: D1Database;
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
};

const app = new Hono<{
  Bindings: Env;
  Variables: { accessClaims: AccessTokenPayload | null };
}>();

const requiredBindings = ['DB', 'ASSETS', 'AI'] as const;
const expectedD1Binding = 'DB' as const;
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

// Sentinel: Security Middleware
app.use('*', secureHeaders());

// Runtime safety guard (fail-fast for misconfigured production runtime).
app.use('*', async (c, next) => {
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
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: ['https://goldshore.ai', 'https://www.goldshore.ai', 'https://admin.goldshore.ai'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion'],
  credentials: true,
}));

app.route('/health', health);
app.route('/user', user);
app.route('/system', system);
app.route('/pages', pages);
app.route('/media', media);

app.get('/', (c) => c.json({ service: 'gs-api', ok: true }));

export default app;
