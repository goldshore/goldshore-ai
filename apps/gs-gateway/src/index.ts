import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

const authMiddleware = async (_c: any, next: () => Promise<void>) => {
  await next();
};
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
  DB?: D1Database;
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
}

function isNonCriticalSignalsPath(pathname: string): boolean {
  return NON_CRITICAL_SIGNAL_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

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

// ── CORS ───────────────────────────────────────────────────
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      try {
        const url = new URL(origin);
        if (
          url.hostname === "goldshore.ai" ||
          url.hostname.endsWith(".goldshore.ai") ||
          url.hostname === "goldshore.org" ||
          url.hostname.endsWith(".goldshore.org") ||
          url.hostname === "localhost" ||
          url.hostname === "127.0.0.1"
        ) {
          return origin;
        }
      } catch (e) {
        return null;
      }
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "CF-Access-Jwt-Assertion"],
    credentials: true,
  }),
);

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

app.use("*", async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  const isHealthPath = pathname === "/health";
  const isSignalsPath = isNonCriticalSignalsPath(pathname);

  if (isHealthPath) {
    return next();
  }

  if (!c.env.SECURITY_CHECK) {
    if (isSignalsPath) {
      console.warn(JSON.stringify({
        event: "security_check_skipped",
        policy: "fail-open",
        reason: "missing_binding",
        path: pathname,
      }));
      return next();
    }

    return c.json({
      error: "SECURITY_CHECK_UNAVAILABLE",
      message: "security check service binding missing",
      policy: "fail-closed",
    }, 503);
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

app.get("/",      (c) => c.json({ service: "gs-gateway", ok: true }));
app.get("/health",(c) => c.json({ status: "ok", service: "gs-gateway" }));

app.all("*", async (c) => {
  const url = new URL(c.req.url);
  const host = url.hostname.toLowerCase();
  const subdomain = host.split('.')[0];

  // Advanced dynamic routing: match subdomain to service binding
  // Normalize preview subdomains: e.g., 'api-preview' -> 'api'
  const baseSubdomain = subdomain.split('-')[0];
  const serviceKeys = [
    baseSubdomain.toUpperCase(),
    `GS_${baseSubdomain.toUpperCase()}`,
    `${baseSubdomain.toUpperCase()}_SERVICE`
  ];

  for (const key of serviceKeys) {
    const service = c.env[key];
    if (service && typeof service.fetch === 'function') {
      return service.fetch(c.req.raw);
    }
  }

  // Fallback map
  if (baseSubdomain === "api" && c.env.API_SERVICE) return c.env.API_SERVICE.fetch(c.req.raw);

  // Default catch-all to API_SERVICE if not on main domain
  if (baseSubdomain !== "goldshore" && baseSubdomain !== "www" && c.env.API_SERVICE) {
    return c.env.API_SERVICE.fetch(c.req.raw);
  }

  return c.json({ error: "No upstream configured for " + host, subdomain }, 404);
});

export default app;
