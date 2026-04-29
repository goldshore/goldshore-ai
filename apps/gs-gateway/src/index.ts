import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { authMiddleware } from "./middleware/auth";

// GatewayEnv must include the auth fields from @goldshore/auth's Env interface
interface GatewayEnv {
  // Auth (required by @goldshore/auth verify.ts)
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  // Core service bindings
  API_SERVICE?: Fetcher;
  AGENT?: Fetcher;
  // Phase 2 service bindings (joinery)
  SECURITY?: Fetcher;   // banproof-me security layer
  SIGNALS?: Fetcher;    // gs-signals-prod trading signals worker
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
// Fails closed if CLOUDFLARE_ACCESS_AUDIENCE is not set.
app.use("*", authMiddleware);

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
