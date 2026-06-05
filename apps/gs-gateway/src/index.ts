import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { STATUS_PAGE_HTML } from "./templates/status";
import { authMiddleware } from "./middleware/auth";
import { integrationControls } from "./middleware/integration";

interface GatewayEnv {
  [key: string]: any;
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  API_SERVICE?: Fetcher;
  AGENT?: Fetcher;
  SECURITY_CHECK?: Fetcher;
  SIGNALS?: Fetcher;
  AI_CACHE?: KVNamespace;
  GS_CONFIG?: KVNamespace;
  GATEWAY_KV?: KVNamespace;
  PLATFORM_DB?: D1Database;
  ASSETS?: R2Bucket;
  MAIL_QUEUE?: Queue;
  CHECKOUT_EVENTS_QUEUE?: Queue;
  CONTACT_EVENTS_QUEUE?: Queue;
  STRIPE_SECRET_KEY?: string;
  API_ORIGIN?: string;
  ACCESS_CLIENT_SECRET?: string;
  ENV?: string;
}

const TRACE_HEADER = "X-Correlation-Id";
const AGENT_HOSTNAME = "agent.goldshore.ai";
const SECURITY_TIMEOUT_MS = 250;
const SIGNALS_TIMEOUT_MS = 1200;
const NON_CRITICAL_SIGNAL_PATHS = ["/signals", "/telemetry", "/events"] as const;

const getCorrelationId = (request: Request): string =>
  request.headers.get(TRACE_HEADER) ?? crypto.randomUUID();

const withCorrelationId = (response: Response, correlationId: string): Response => {
  const headers = new Headers(response.headers);
  headers.set(TRACE_HEADER, correlationId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function isNonCriticalSignalsPath(pathname: string): boolean {
  return NON_CRITICAL_SIGNAL_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

function isAgentHostnameRequest(request: Request): boolean {
  try { return new URL(request.url).hostname === AGENT_HOSTNAME; }
  catch { return false; }
}

const app = new Hono<{ Bindings: GatewayEnv }>();

// ── Security headers ───────────────────────────────────────
app.use("*", secureHeaders());

// ── Startup binding guard (production only) ────────────────
app.use("*", async (c, next) => {
  if (c.env.ENV === "production" && !c.env.CLOUDFLARE_ACCESS_AUDIENCE) {
    console.error("CRITICAL: CLOUDFLARE_ACCESS_AUDIENCE is not set. Refusing to serve requests.");
    return c.json({ error: "Service Unavailable", message: "Auth configuration incomplete", code: "AUDIENCE_MISSING" }, 503);
  }
  await next();
});

// ── CORS ───────────────────────────────────────────────────
app.use("*", cors({
  origin: (origin, c) => {
    if (c.env.ENV !== "production") {
      if (origin && (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1"))) return origin;
    }
    const allowed = [
      "https://goldshore.ai", "https://www.goldshore.ai", "https://admin.goldshore.ai",
      "https://gw.goldshore.ai", "https://api.goldshore.ai",
    ];
    return allowed.includes(origin ?? "") ? origin : null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "CF-Access-Jwt-Assertion", "X-Data-Classification", "X-Secrets-Access-Policy", "X-Audit-Trace-Id"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true,
}));

// ── Auth — fail-closed JWT verification ───────────────────
app.use("*", authMiddleware);

// ── Security check (banproof-me service binding) ───────────
app.use("*", async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  if (pathname === "/health") return next();
  if (!c.env.SECURITY_CHECK) {
    console.warn(JSON.stringify({ event: "security_check_skipped", policy: "fail-open", reason: "missing_binding", path: pathname }));
    return next();
  }
  const isSignalsPath = isNonCriticalSignalsPath(pathname);
  try {
    const timeoutMs = isSignalsPath ? SIGNALS_TIMEOUT_MS : SECURITY_TIMEOUT_MS;
    const checkResponse = await withTimeout(c.env.SECURITY_CHECK.fetch(c.req.raw.clone()), timeoutMs, "SECURITY_CHECK");
    if (!checkResponse.ok) {
      if (isSignalsPath) {
        console.warn(JSON.stringify({ event: "security_check_non_ok", policy: "fail-open", status: checkResponse.status, path: pathname }));
        return next();
      }
      return c.json({ error: "SECURITY_CHECK_FAILED", message: "security policy rejected request", policy: "fail-closed" }, 403);
    }
  } catch (error) {
    if (isSignalsPath) {
      console.warn(JSON.stringify({ event: "security_check_error", policy: "fail-open", path: pathname, error: error instanceof Error ? error.message : String(error) }));
      return next();
    }
    return c.json({ error: "SECURITY_CHECK_ERROR", message: "security check service unavailable", policy: "fail-closed" }, 503);
  }

  return next();
});

// ── Integration controls ───────────────────────────────────
// Enforces X-Data-Classification, X-Secrets-Access-Policy, and X-Audit-Trace-Id
// on /integrations/* and /market-streams/* paths.
app.use("*", integrationControls);

// ── Agent hostname routing ─────────────────────────────────
// Requests arriving on agent.goldshore.ai are proxied to the AGENT service binding.
app.use("*", async (c, next) => {
  if (!isAgentHostnameRequest(c.req.raw)) {
    return next();
  }

  const correlationId = getCorrelationId(c.req.raw);

  if (!c.env.AGENT) {
    console.error(`[gateway] downstream agent not configured; trace=${correlationId}`);
    return c.json(
      { error: "Downstream agent not configured", traceId: correlationId },
      503,
      { [TRACE_HEADER]: correlationId },
    );
  }

  const downstreamRequest = new Request(c.req.raw, { headers: new Headers(c.req.raw.headers) });
  downstreamRequest.headers.set(TRACE_HEADER, correlationId);
  const response = await c.env.AGENT.fetch(downstreamRequest);
  return withCorrelationId(response, correlationId);
});

// ── Routes ─────────────────────────────────────────────────

app.get("/health", (c) => c.json({ status: "ok", service: "gs-gateway" }));

app.get("/", (c) => c.html(STATUS_PAGE_HTML));

app.get("/templates", (c) =>
app.get('/health', (c) => c.json({ status: 'ok', service: 'gs-gateway' }));
app.get('/templates', (c) =>
  c.json({
    service: "gs-gateway",
    description: "Gateway template routes for routing, auth, and AI dispatch.",
    modules: [
      { name: "routing", purpose: "Proxy requests to gs-api or partner services with consistent observability." },
      { name: "ai-dispatch", purpose: "Send AI requests to Gemini, ChatGPT, Jules, or Cloudflare AI Gateway." },
      { name: "market-streams", purpose: "Broker market data connections for Alpaca, Thinkorswim, and other feeds." },
    ],
    nextSteps: [
      "Add per-route rate limits and request shaping.",
      "Define queue-backed workflows for bursty workloads.",
      "Publish route maps to admin dashboards.",
    ],
  }),
);

app.get("/user/login", (c) => c.json({ message: "Gateway Login Placeholder" }));
app.post("/v1/chat", (c) => c.json({ message: "Gateway Chat Placeholder" }));

const inferApiOrigin = (requestUrl: string): string | undefined => {
  const url = new URL(requestUrl);
  const inferredHostname = url.hostname.replace(/^gs-gateway(?=\.|$)/, "gs-api");
  if (inferredHostname === url.hostname) {
    return undefined;
  }
  url.hostname = inferredHostname;
  return url.origin;
};

// Forward /api/* to the API_SERVICE binding; fall back to API_ORIGIN if unbound.
app.all("/api/*", async (c) => {
  const correlationId = getCorrelationId(c.req.raw);
  const apiOrigin = c.env.API_ORIGIN ?? inferApiOrigin(c.req.url);
  try {
    if (c.env.API_SERVICE) {
      const response = await c.env.API_SERVICE.fetch(c.req.raw);
      return withCorrelationId(response, correlationId);
    }
    if (apiOrigin) {
      const url = new URL(c.req.url);
      const targetUrl = new URL(url.pathname + url.search, apiOrigin);
      const upstreamRequest = new Request(targetUrl, c.req.raw);
      upstreamRequest.headers.set(TRACE_HEADER, correlationId);
      const response = await fetch(upstreamRequest);
      return withCorrelationId(response, correlationId);
    }
    console.error(`[gateway] upstream API not configured; trace=${correlationId}`);
    return c.json(
      { error: "Upstream API not configured", traceId: correlationId },
      500,
      { [TRACE_HEADER]: correlationId },
    );
  } catch (error) {
    console.error(`[gateway] upstream request failed; trace=${correlationId}`, error);
    return c.json(
      { error: "Upstream request failed", traceId: correlationId },
      502,
      { [TRACE_HEADER]: correlationId },
    );
  }
});

// ── Integration controls ───────────────────────────────────
// Enforces X-Data-Classification, X-Secrets-Access-Policy, and X-Audit-Trace-Id
// on /integrations/* and /market-streams/* paths.
app.use("*", integrationControls);

// ── Agent hostname routing ─────────────────────────────────
app.use("*", async (c, next) => {
  if (!isAgentHostnameRequest(c.req.raw)) return next();
  const correlationId = getCorrelationId(c.req.raw);
  if (!c.env.AGENT) {
    console.error(`[gateway] downstream agent not configured; trace=${correlationId}`);
    return c.json({ error: "Downstream agent not configured", traceId: correlationId }, 503, { [TRACE_HEADER]: correlationId });
  }
  const downstreamRequest = new Request(c.req.raw, { headers: new Headers(c.req.raw.headers) });
  downstreamRequest.headers.set(TRACE_HEADER, correlationId);
  const response = await c.env.AGENT.fetch(downstreamRequest);
  return withCorrelationId(response, correlationId);
});

// ── Routes ─────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok", service: "gs-gateway" }));

app.get("/", (c) => c.html(STATUS_PAGE_HTML));

app.get("/templates", (c) =>
  c.json({
    service: "gs-gateway",
    description: "Gateway template routes for routing, auth, and AI dispatch.",
    modules: [
      { name: "routing", purpose: "Proxy requests to gs-api or partner services with consistent observability." },
      { name: "ai-dispatch", purpose: "Send AI requests to Gemini, ChatGPT, Jules, or Cloudflare AI Gateway." },
      { name: "market-streams", purpose: "Broker market data connections for Alpaca, Thinkorswim, and other feeds." },
    ],
    nextSteps: [
      "Add per-route rate limits and request shaping.",
      "Define queue-backed workflows for bursty workloads.",
      "Publish route maps to admin dashboards.",
    ],
  }),
);

app.get("/user/login", (c) => c.json({ message: "Gateway Login Placeholder" }));
app.post("/v1/chat", (c) => c.json({ message: "Gateway Chat Placeholder" }));

const inferApiOrigin = (requestUrl: string): string | undefined => {
  const url = new URL(requestUrl);
  const inferredHostname = url.hostname.replace(/^gs-gateway(?=\.|$)/, "gs-api");
  if (inferredHostname === url.hostname) return undefined;
  url.hostname = inferredHostname;
  return url.origin;
};

app.all("/api/*", async (c) => {
  const correlationId = getCorrelationId(c.req.raw);
  const apiOrigin = c.env.API_ORIGIN ?? inferApiOrigin(c.req.url);
  try {
    if (c.env.API_SERVICE) {
      const response = await c.env.API_SERVICE.fetch(c.req.raw);
      return withCorrelationId(response, correlationId);
    }
    if (apiOrigin) {
      const url = new URL(c.req.url);
      const targetUrl = new URL(url.pathname + url.search, apiOrigin);
      const upstreamRequest = new Request(targetUrl, c.req.raw);
      upstreamRequest.headers.set(TRACE_HEADER, correlationId);
      const response = await fetch(upstreamRequest);
      return withCorrelationId(response, correlationId);
    }
    console.error(`[gateway] upstream API not configured; trace=${correlationId}`);
    return c.json({ error: "Upstream API not configured", traceId: correlationId }, 500, { [TRACE_HEADER]: correlationId });
  } catch (error) {
    console.error(`[gateway] upstream request failed; trace=${correlationId}`, error);
    return c.json({ error: "Upstream request failed", traceId: correlationId }, 502, { [TRACE_HEADER]: correlationId });
  }
});

app.all("*", (c) => c.json({ error: "Not found" }, 404));

export default app;
