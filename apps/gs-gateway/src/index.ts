import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { authMiddleware } from "./middleware/auth";

// GatewayEnv must include the auth fields from @goldshore/auth's Env interface
interface GatewayEnv {
  // Auth (required by @goldshore/auth verify.ts)
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  // Service bindings
  API_SERVICE?: Fetcher;
  AGENT?: Fetcher;
  SECURITY_CHECK?: Fetcher;
  // KV
  AI_CACHE?: KVNamespace;
  GATEWAY_KV?: KVNamespace;
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

const requiredBindings = ["API_SERVICE", "AI_CACHE"] as const;
const requiredSecrets  = ["ACCESS_CLIENT_SECRET"] as const;

// ── Security headers ───────────────────────────────────────
app.use("*", secureHeaders());

// ── Startup binding guard (production only) ────────────────
app.use("*", async (c, next) => {
  if (c.env.ENV === "production") {
    for (const key of [...requiredBindings, ...requiredSecrets]) {
      if (!c.env[key]) {
        throw new Error(`CRITICAL_MISSING: ${key}. Terminating.`);
      }
    }
  }
  await next();
});

// ── CORS ───────────────────────────────────────────────────
app.use(
  "*",
  cors({
    origin: [
      "https://goldshore.ai",
      "https://www.goldshore.ai",
      "https://admin.goldshore.ai",
    ],
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

// ── Public routes ──────────────────────────────────────────
app.get("/",      (c) => c.json({ service: "gs-gateway", ok: true }));
app.get("/health",(c) => c.json({ status: "ok", service: "gs-gateway" }));

// ── Routing ────────────────────────────────────────────────
app.all("*", async (c) => {
  const host = new URL(c.req.url).hostname.toLowerCase();

  // agent.goldshore.ai → gs-agent service binding
  if (host.startsWith("agent.")) {
    if (!c.env.AGENT) {
      return c.json({ error: "AGENT service binding not configured" }, 500);
    }
    return c.env.AGENT.fetch(c.req.raw);
  }

  // Everything else → gs-api
  if (c.env.API_SERVICE) {
    return c.env.API_SERVICE.fetch(c.req.raw);
  }

  if (c.env.API_ORIGIN) {
    const url = new URL(c.req.url);
    const target = new URL(url.pathname + url.search, c.env.API_ORIGIN);
    return fetch(target.toString(), c.req.raw);
  }

  return c.json({ error: "No upstream configured" }, 500);
});

export default app;
