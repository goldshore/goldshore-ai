import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { STATUS_PAGE_HTML } from './templates/status';
import { type Env } from './types';
import { checkAuth } from './auth';
import { integrationControls } from './middleware/integration';

const app = new Hono<{ Bindings: Env }>();

const TRACE_HEADER = 'X-Correlation-Id';
const AGENT_HOSTNAME = 'agent.goldshore.ai';

const getCorrelationId = (request: Request): string => {
  return request.headers.get(TRACE_HEADER) ?? crypto.randomUUID();
};

const withCorrelationId = (response: Response, correlationId: string): Response => {
  const headers = new Headers(response.headers);
  headers.set(TRACE_HEADER, correlationId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { authMiddleware } from "./middleware/auth";
interface GatewayEnv {
  [key: string]: any;
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  API_SERVICE?: Fetcher;
  AGENT?: Fetcher;
  SECURITY_CHECK?: Fetcher;
  // KV
  AI_CACHE?: KVNamespace;
  GS_CONFIG?: KVNamespace;
  GATEWAY_KV?: KVNamespace;
  // D1
  PLATFORM_DB?: D1Database;
  // R2
  ASSETS?: R2Bucket;
  // Queue producers
  MAIL_QUEUE?: Queue;   // gs-mail-jobs queue
  // Stripe (secret — never logged, never returned in responses)
  STRIPE_SECRET_KEY?: string;
  // Config
  API_ORIGIN?: string;
  ACCESS_CLIENT_SECRET?: string;
  ENV?: string;
}

const SECURITY_TIMEOUT_MS = 250;
const SIGNALS_TIMEOUT_MS = 1200;
const NON_CRITICAL_SIGNAL_PATHS = ["/signals", "/telemetry", "/events"] as const;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
};

const app = new Hono<{ Bindings: GatewayEnv }>();

function isNonCriticalSignalsPath(pathname: string): boolean {
  return NON_CRITICAL_SIGNAL_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

const app = new Hono<{ Bindings: GatewayEnv }>();

// ── Security headers ───────────────────────────────────────
app.use("*", secureHeaders());

// ── Startup binding guard (production only) ────────────────
// Fail CLOSED: hard-stop (503) when critical bindings/secrets are absent.
// STRIPE_SECRET_KEY absence is enforced per-request in authMiddleware (fail closed).
app.use("*", async (c, next) => {
  if (c.env.ENV === "production") {
    // CRITICAL: CLOUDFLARE_ACCESS_AUDIENCE must be set in production.
    // Without it, JWT audience verification is skipped — tokens from other
    // CF Access applications would be accepted (auth bypass).
    if (!c.env.CLOUDFLARE_ACCESS_AUDIENCE) {
      console.error(
        "CRITICAL: CLOUDFLARE_ACCESS_AUDIENCE is not set. Refusing to serve requests.",
      );
      return c.json(
        {
          error: "Service Unavailable",
          message: "Auth configuration incomplete",
          code: "AUDIENCE_MISSING",
        },
        503,
      );
    }
  }
  await next();
});

const ALLOWED_ORIGINS = [
  'https://goldshore.ai',
  'https://www.goldshore.ai',
  'https://admin.goldshore.ai',
  'https://gw.goldshore.ai',
  'https://api.goldshore.ai'
];

// Sentinel: Add security headers to all responses (X-Frame-Options, X-XSS-Protection, etc.)
app.use('*', secureHeaders());

// Sentinel: Add CORS protection
app.use('*', cors({
  origin: (origin, c) => {
    // Development overrides
    if (c.env.ENV !== 'production') {
      if (origin && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
        return origin;
      }
    }

// ── Auth (uses existing @goldshore/auth verify.ts) ─────────
// authMiddleware skips /health, /, OPTIONS automatically.
// Audience validation is enforced only when CLOUDFLARE_ACCESS_AUDIENCE is set.
app.use("*", (c, next) => authMiddleware(c.req.raw, c.env, next));

app.use("*", async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  const isHealthPath = pathname === "/health";
  const isSignalsPath = isNonCriticalSignalsPath(pathname);

  if (isHealthPath) {
    return next();
  }

  if (!c.env.SECURITY_CHECK) {
    console.warn(JSON.stringify({
      event: "security_check_skipped",
      policy: "fail-open",
      reason: "missing_binding",
      path: pathname,
    }));
    return next();
  }

  try {
    const timeoutMs = isSignalsPath ? SIGNALS_TIMEOUT_MS : SECURITY_TIMEOUT_MS;
    const checkResponse = await withTimeout(
      c.env.SECURITY_CHECK.fetch(c.req.raw.clone()),
      timeoutMs,
      "SECURITY_CHECK",
    );

    if (!checkResponse.ok) {
      if (isSignalsPath) {
        console.warn(JSON.stringify({
          event: "security_check_non_ok",
          policy: "fail-open",
          status: checkResponse.status,
          path: pathname,
        }));
        return next();
      }

      return c.json({
        error: "SECURITY_CHECK_FAILED",
        message: "security policy rejected request",
        policy: "fail-closed",
      }, 403);
    }
  } catch (error) {
    if (isSignalsPath) {
      console.warn(JSON.stringify({
        event: "security_check_error",
        policy: "fail-open",
        path: pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return next();
    }

    return c.json({
      error: "SECURITY_CHECK_ERROR",
      message: "security check service unavailable",
      policy: "fail-closed",
    }, 503);
  }

  return next();
});

    return null; // Block unknown origins
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'CF-Access-Jwt-Assertion',
    'X-Data-Classification',
    'X-Secrets-Access-Policy',
    'X-Audit-Trace-Id'
  ],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true
}));

// Authentication Middleware
app.use('*', async (c, next) => {
    // Skip auth for health check, root, and OPTIONS requests
    if (c.req.path === '/health' || c.req.path === '/' || c.req.method === 'OPTIONS') {
        await next();
        return;
    }

    if (c.env.ENV === 'production' && !c.env.CLOUDFLARE_ACCESS_AUDIENCE) {
        console.error('SECURITY ERROR: CLOUDFLARE_ACCESS_AUDIENCE must be configured for protected gs-gateway routes in production.');
        return c.json({ error: 'Service auth misconfigured' }, 500);
    }

    const authorized = await checkAuth(c.req.raw, c.env);
    if (!authorized) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
});

// Integration controls: data classification, secrets access, and audit trail enforcement
app.use('*', integrationControls);

app.use('*', async (c, next) => {
  if (!isAgentHostnameRequest(c.req.raw)) {
    await next();
    return;
  }

  const correlationId = getCorrelationId(c.req.raw);

  if (!c.env.AGENT) {
    console.error(`[gateway] downstream agent not configured; trace=${correlationId}`);
    return c.json({ error: 'Downstream agent not configured', traceId: correlationId }, 503, {
      [TRACE_HEADER]: correlationId
    });
  }

  const downstreamRequest = new Request(c.req.raw, {
    headers: new Headers(c.req.raw.headers)
  });
  downstreamRequest.headers.set(TRACE_HEADER, correlationId);

  const response = await c.env.AGENT.fetch(downstreamRequest);
  return withCorrelationId(response, correlationId);
});

app.get('/health', (c) => c.json({ status: 'ok', service: 'gs-gateway' }));
app.get('/templates', (c) =>
  c.json({
    service: 'gs-gateway',
    description: 'Gateway template routes for routing, auth, and AI dispatch.',
    modules: [
      {
        name: 'routing',
        purpose: 'Proxy requests to gs-api or partner services with consistent observability.'
      },
      {
        name: 'ai-dispatch',
        purpose: 'Send AI requests to Gemini, ChatGPT, Jules, or Cloudflare AI Gateway.'
      },
      {
        name: 'market-streams',
        purpose: 'Broker market data connections for Alpaca, Thinkorswim, and other feeds.'
      }
    ],
    nextSteps: [
      'Add per-route rate limits and request shaping.',
      'Define queue-backed workflows for bursty workloads.',
      'Publish route maps to admin dashboards.'
    ]
  })
);

// Root Status Page
app.get('/', (c) => {
  return c.html(STATUS_PAGE_HTML);
});

// Example specific routes
app.get('/user/login', (c) => c.json({ message: 'Gateway Login Placeholder' }));
app.post('/v1/chat', (c) => c.json({ message: 'Gateway Chat Placeholder' }));

// Forward requests intentionally scoped to /api/*.
app.all('/api/*', async (c) => {
    const correlationId = getCorrelationId(c.req.raw);

    try {
        // If we have an API binding, use it (recommended for Service Bindings)
        if (c.env.API) {
            const response = await c.env.API.fetch(c.req.raw);
            return withCorrelationId(response, correlationId);
        }

        // Fallback logic for environments without Service Bindings
        if (c.env.API_ORIGIN) {
            const url = new URL(c.req.url);
            const targetUrl = new URL(url.pathname + url.search, c.env.API_ORIGIN);
            const upstreamRequest = new Request(targetUrl, c.req.raw);
            upstreamRequest.headers.set(TRACE_HEADER, correlationId);
            const response = await fetch(upstreamRequest);
            return withCorrelationId(response, correlationId);
        }

        console.error(`[gateway] upstream API not configured; trace=${correlationId}`);
        return c.json({ error: 'Upstream API not configured', traceId: correlationId }, 500, {
          [TRACE_HEADER]: correlationId
        });
    } catch (error) {
        console.error(`[gateway] upstream request failed; trace=${correlationId}`, error);
        return c.json({ error: 'Upstream request failed', traceId: correlationId }, 502, {
          [TRACE_HEADER]: correlationId
        });
    }
});

app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export default app;
