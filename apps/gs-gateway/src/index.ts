import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { STATUS_PAGE_HTML } from "./templates/status";
import { authMiddleware } from "./middleware/auth";
import { integrationControls } from "./middleware/integration";

// GatewayEnv covers all bindings declared in wrangler.toml (prod/preview/dev).
interface GatewayEnv {
  [key: string]: any;
  // Auth
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  // Service bindings
  API_SERVICE?: Fetcher;
  AGENT?: Fetcher;
  SECURITY_CHECK?: Fetcher;
  SIGNALS?: Fetcher;
  // KV
  AI_CACHE?: KVNamespace;
  GS_CONFIG?: KVNamespace;
  GATEWAY_KV?: KVNamespace;
  // D1
  PLATFORM_DB?: D1Database;
  // R2
  ASSETS?: R2Bucket;
  // Queue producers
  MAIL_QUEUE?: Queue;
  CHECKOUT_EVENTS_QUEUE?: Queue;
  CONTACT_EVENTS_QUEUE?: Queue;
  // Stripe (secret — never logged, never returned in responses)
  STRIPE_SECRET_KEY?: string;
  // Config
  API_ORIGIN?: string;
  ACCESS_CLIENT_SECRET?: string;
  ENV?: string;
}

const TRACE_HEADER = "X-Correlation-Id";
const AGENT_HOSTNAME = "agent.goldshore.ai";
const API_HOSTNAME = "api.goldshore.ai";
const SECURITY_TIMEOUT_MS = 250;
const SIGNALS_TIMEOUT_MS = 1200;
const NON_CRITICAL_SIGNAL_PATHS = ["/signals", "/telemetry", "/events"] as const;

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
  return NON_CRITICAL_SIGNAL_PATHS.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

function hasHostname(request: Request, hostname: string): boolean {
  try {
    return new URL(request.url).hostname === hostname;
  } catch {
    return false;
  }
}

const isAgentHostnameRequest = (request: Request) => hasHostname(request, AGENT_HOSTNAME);
const isApiHostnameRequest = (request: Request) => hasHostname(request, API_HOSTNAME);

const app = new Hono<{ Bindings: GatewayEnv }>();

// ── Security headers ───────────────────────────────────────
app.use("*", secureHeaders());

// ── Startup binding guard (production only) ────────────────
// Fail CLOSED: refuse all requests when CLOUDFLARE_ACCESS_AUDIENCE is absent in
// production, preventing token-reuse across CF Access applications.
app.use("*", async (c, next) => {
  if (c.env.ENV === "production" && !c.env.CLOUDFLARE_ACCESS_AUDIENCE) {
    console.error("CRITICAL: CLOUDFLARE_ACCESS_AUDIENCE is not set. Refusing to serve requests.");
    return c.json(
      { error: "Service Unavailable", message: "Auth configuration incomplete", code: "AUDIENCE_MISSING" },
      503,
    );
  }
  await next();
});

// ── CORS ───────────────────────────────────────────────────
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (c.env.ENV !== "production") {
        if (origin && (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1"))) {
          return origin;
        }
      }
      const allowed = [
        "https://goldshore.ai",
        "https://www.goldshore.ai",
        "https://admin.goldshore.ai",
        "https://gw.goldshore.ai",
        "https://api.goldshore.ai",
      ];
      return allowed.includes(origin ?? "") ? origin : null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "CF-Access-Jwt-Assertion",
      "X-Data-Classification",
      "X-Secrets-Access-Policy",
      "X-Audit-Trace-Id",
    ],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

// ── Auth — fail-closed JWT verification ───────────────────
// authMiddleware skips the public paths (/health, /, /status, /signals).
// CORS is registered above and may handle OPTIONS preflight requests before auth runs.
// STRIPE_SECRET_KEY absence is also enforced per-request inside authMiddleware.
app.use("*", authMiddleware);

// ── Security check (banproof-me service binding) ───────────
// /health bypasses; signals paths fail-open on error; everything else fails closed.
app.use("*", async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  if (pathname === "/health") {
    return next();
  }

  const isSignalsPath = isNonCriticalSignalsPath(pathname);
  if (!c.env.SECURITY_CHECK) {
    const policy = isSignalsPath ? "fail-open" : "fail-closed";
    console.warn(
      JSON.stringify({ event: "security_check_missing", policy, reason: "missing_binding", path: pathname }),
    );
    if (isSignalsPath) {
      return next();
    }
    return c.json(
      { error: "SECURITY_CHECK_ERROR", message: "security check service unavailable", policy },
      503,
    );
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
        console.warn(
          JSON.stringify({ event: "security_check_non_ok", policy: "fail-open", status: checkResponse.status, path: pathname }),
        );
        return next();
      }
      return c.json({ error: "SECURITY_CHECK_FAILED", message: "security policy rejected request", policy: "fail-closed" }, 403);
    }
  } catch (error) {
    if (isSignalsPath) {
      console.warn(
        JSON.stringify({ event: "security_check_error", policy: "fail-open", path: pathname, error: error instanceof Error ? error.message : String(error) }),
      );
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

// ── Canonical API hostname routing ─────────────────────────
// api.goldshore.ai is owned by this gateway, so every path on that host must
// be forwarded to gs-api rather than falling through to gateway-local routes.
app.use("*", async (c, next) => {
  if (!isApiHostnameRequest(c.req.raw)) {
    return next();
  }
  return proxyApiRequest(c, false);
});

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

async function proxyApiRequest(
  c: Context<{ Bindings: GatewayEnv }>,
  stripApiPrefix: boolean,
): Promise<Response> {
  const correlationId = getCorrelationId(c.req.raw);
  const sourceUrl = new URL(c.req.url);
  if (stripApiPrefix) {
    sourceUrl.pathname = sourceUrl.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  }

  try {
    if (c.env.API_SERVICE) {
      const upstreamRequest = new Request(sourceUrl, c.req.raw);
      upstreamRequest.headers.set(TRACE_HEADER, correlationId);
      const response = await c.env.API_SERVICE.fetch(upstreamRequest);
      return withCorrelationId(response, correlationId);
    }

    const apiOrigin = c.env.API_ORIGIN ?? inferApiOrigin(c.req.url);
    if (apiOrigin && new URL(apiOrigin).hostname !== sourceUrl.hostname) {
      const targetUrl = new URL(sourceUrl.pathname + sourceUrl.search, apiOrigin);
      const upstreamRequest = new Request(targetUrl, c.req.raw);
      upstreamRequest.headers.set(TRACE_HEADER, correlationId);
      const response = await fetch(upstreamRequest);
      return withCorrelationId(response, correlationId);
    }

    console.error(`[gateway] upstream API not configured; trace=${correlationId}`);
    return c.json(
      { error: "Upstream API not configured", traceId: correlationId },
      503,
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
}

// Keep the legacy /api prefix working, but remove it before gs-api dispatch.
app.all("/api", (c) => proxyApiRequest(c, true));
app.all("/api/*", (c) => proxyApiRequest(c, true));

app.all("*", (c) => c.json({ error: "Not found" }, 404));

export default app;
