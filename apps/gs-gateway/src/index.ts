import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { verifyAccess } from '@goldshore/auth';
import { STATUS_PAGE_HTML } from './templates/status';
import { type Env } from './types';
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
  });
};

const isAgentHostnameRequest = (request: Request): boolean => {
  return new URL(request.url).hostname === AGENT_HOSTNAME;
};

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

    // Strict origin check for production (and dev non-localhost)
    if (ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }

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

    if (!c.env.CLOUDFLARE_ACCESS_AUDIENCE) {
        console.warn('SECURITY WARNING: CLOUDFLARE_ACCESS_AUDIENCE is not set. Audience verification is disabled.');
    }

    const authorized = await verifyAccess(c.req.raw, c.env);
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
            const response = await fetch(targetUrl.toString(), c.req.raw);
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
