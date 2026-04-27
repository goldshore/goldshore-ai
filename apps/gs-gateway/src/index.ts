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
  AI_CACHE?: KVNamespace;
  ENV?: string;
}

const app = new Hono<{ Bindings: GatewayEnv }>();

app.use("*", secureHeaders());

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

app.use("*", authMiddleware);

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
