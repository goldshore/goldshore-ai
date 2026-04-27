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
  // KV
  AI_CACHE?: KVNamespace;
  GATEWAY_KV?: KVNamespace;
  // Config
  API_ORIGIN?: string;
  ACCESS_CLIENT_SECRET?: string;
  ENV?: string;
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
