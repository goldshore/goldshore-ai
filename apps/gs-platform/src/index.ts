import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import {
  verifyAccessWithClaims,
  type AccessTokenPayload,
} from "@goldshore/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformEnv {
  // Auth (required by @goldshore/auth verify.ts)
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;

  // D1
  PLATFORM_DB: D1Database;

  // KV
  GATEWAY_KV?: KVNamespace;
  GOLDSHORE_KV?: KVNamespace;

  // R2
  ASSETS?: R2Bucket;

  // Service bindings (hub → spoke)
  SECURITY?: Fetcher; // banproof-me
  SIGNALS?: Fetcher; // gs-signals-prod
  MAIL?: Fetcher; // gs-mail
  CORE?: Fetcher; // gs-core-worker

  // Runtime
  ENV?: string;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono<{
  Bindings: PlatformEnv;
  Variables: { accessClaims: AccessTokenPayload | null };
}>();

// ---------------------------------------------------------------------------
// Allowed origins for CORS
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  "https://goldshore.ai",
  "https://www.goldshore.ai",
  "https://admin.goldshore.ai",
  "https://preview.goldshore.ai",
  "https://armsway.com",
  "https://www.armsway.com",
];

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use("*", secureHeaders());

// ---------------------------------------------------------------------------
// CORS — applied early so error responses always include CORS headers
// ---------------------------------------------------------------------------
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      return ALLOWED_ORIGINS.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "CF-Access-Jwt-Assertion"],
    credentials: true,
    maxAge: 600,
  }),
);

// ---------------------------------------------------------------------------
// Helper: returns true for hosts that require authentication
// ---------------------------------------------------------------------------
function isProtectedHost(hostname: string): boolean {
  return hostname === "admin.goldshore.ai";
}

// ---------------------------------------------------------------------------
// CRITICAL: Fail closed when CLOUDFLARE_ACCESS_AUDIENCE is not set.
// Only enforced on protected (admin) hosts — public domains are fail-open.
// ---------------------------------------------------------------------------
app.use("*", async (c, next) => {
  const host = new URL(c.req.url).hostname.toLowerCase();

  // Public hosts and common health routes skip the audience guard
  if (!isProtectedHost(host) || c.req.path === "/" || c.req.path === "/health") {
    return next();
  }

  if (!c.env.CLOUDFLARE_ACCESS_AUDIENCE) {
    console.error(
      "FATAL: CLOUDFLARE_ACCESS_AUDIENCE not set — rejecting all protected requests",
    );
    return c.json(
      {
        error: "Service misconfigured",
        code: "AUDIENCE_NOT_SET",
        message:
          "Authentication audience is not configured. All protected routes are unavailable.",
      },
      503,
    );
  }

  return next();
});

// ---------------------------------------------------------------------------
// Auth middleware — enforces JWT verification on protected hosts only
// ---------------------------------------------------------------------------
app.use("*", async (c, next) => {
  const host = new URL(c.req.url).hostname.toLowerCase();

  // Public hosts and public routes bypass auth entirely
  if (
    !isProtectedHost(host) ||
    c.req.path === "/" ||
    c.req.path === "/health" ||
    c.req.method === "OPTIONS"
  ) {
    c.set("accessClaims", null);
    return next();
  }

  const claims = await verifyAccessWithClaims(c.req.raw, c.env);
  if (!claims) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Valid CF-Access-Jwt-Assertion header required",
        code: "AUTH_FAILED",
      },
      401,
    );
  }

  c.set("accessClaims", claims);
  return next();
});

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------
app.get("/", (c) => c.json({ service: "gs-platform", ok: true }));
app.get("/health", (c) =>
  c.json({ status: "ok", service: "gs-platform", ts: Date.now() }),
);

// ---------------------------------------------------------------------------
// Host-based routing to service bindings
// ---------------------------------------------------------------------------
app.all("*", async (c) => {
  const host = new URL(c.req.url).hostname.toLowerCase();

  // armsway.com → CORE service binding (Gearswipe / StellarAIO)
  if (host === "armsway.com" || host === "www.armsway.com") {
    if (!c.env.CORE) {
      return c.json({ error: "CORE service binding not configured" }, 500);
    }
    return c.env.CORE.fetch(c.req.raw);
  }

  // admin.goldshore.ai — this worker no longer intercepts admin traffic.
  // gs-admin Pages project serves admin.goldshore.ai directly via custom domain.
  // If this handler is reached, it means the Pages project custom domain is not yet
  // configured. Return a clear diagnostic instead of a silent JSON stub.
  if (host === "admin.goldshore.ai") {
    return c.html(
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <title>Admin – Configuration Required</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font-family:system-ui,sans-serif;max-width:600px;margin:4rem auto;padding:0 1rem;color:#111}
      h1{font-size:1.4rem;color:#c00}code{background:#f3f4f6;padding:2px 6px;border-radius:3px;font-size:.9em}
      a{color:#1d4ed8}</style></head>
      <body><h1>Admin dashboard is not reachable</h1>
      <p>The <code>gs-admin</code> Cloudflare Pages project has not been deployed or its
      custom domain (<code>admin.goldshore.ai</code>) has not been configured.</p>
      <h2>To fix this:</h2>
      <ol>
        <li>Run <code>pnpm --filter gs-admin build</code></li>
        <li>Run <code>wrangler pages deploy dist --project-name gs-admin</code></li>
        <li>In the Cloudflare Pages dashboard → gs-admin → Custom domains → add <code>admin.goldshore.ai</code></li>
        <li>Remove or disable the <code>admin.goldshore.ai/*</code> worker route in gs-platform if it still exists</li>
      </ol>
      </body></html>`,
      503,
    );
  }

  // Default: any other host hitting this worker returns a diagnostic JSON.
  return c.json({ service: "gs-platform", host, ok: true });
});

export default app;
