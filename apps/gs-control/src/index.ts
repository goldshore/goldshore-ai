import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { parseSystemSyncWritePayload } from "@goldshore/schema";
import { verifyAccessWithClaims, type AccessTokenPayload } from "@goldshore/auth";

interface ControlEnv {
  ALLOWED_ORIGINS?: string;
  GS_CONFIG: KVNamespace;
  CONTROL_LOGS: KVNamespace;
}

const defaultAllowedOrigins = [
  "https://admin.goldshore.ai",
  "https://admin-preview.goldshore.ai",
  "http://localhost:4321",
];

export const createApp = () => {
  const app = new Hono<{
    Bindings: ControlEnv;
    Variables: {
      accessClaims: AccessTokenPayload | null;
    };
  }>();

  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
      origin: (origin, c) => {
        const configuredOrigins = c.env.ALLOWED_ORIGINS
          ? c.env.ALLOWED_ORIGINS.split(",").map((value) => value.trim())
          : defaultAllowedOrigins;

        return origin && configuredOrigins.includes(origin) ? origin : undefined;
      },
      allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "CF-Access-Jwt-Assertion"],
      credentials: true,
    }),
  );

  app.use("*", async (c, next) => {
    if (c.req.path === "/" || c.req.method === "OPTIONS") {
      await next();
      return;
    }

    const claims = await verifyAccessWithClaims(c.req.raw, c.env);
    if (!claims) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("accessClaims", claims);
    await next();
  });

  app.get("/", (c) => c.json({ service: "gs-control", ok: true }));

  app.post("/system/sync", async (c) => {
    const claims = c.get("accessClaims");
    const payload = parseSystemSyncWritePayload(await c.req.json());

    if (!payload.success) {
      return c.json({ error: "Validation Failed", details: payload.error.format() }, 400);
    }

    const timestamp = new Date().toISOString();
    await Promise.all([
      c.env.GS_CONFIG.put("ROUTING_TABLE", JSON.stringify(payload.data.ROUTING_TABLE)),
      c.env.GS_CONFIG.put("SERVICE_STATUS", JSON.stringify(payload.data.SERVICE_STATUS)),
      c.env.GS_CONFIG.put("AI_ORCHESTRATION", JSON.stringify(payload.data.AI_ORCHESTRATION)),
      c.env.CONTROL_LOGS.put(
        `sync_${Date.now()}`,
        JSON.stringify({ user: claims?.email ?? null, timestamp }),
      ),
    ]);

    return c.json({ success: true, syncedAt: timestamp });
  });

  app.post("/dns/apply", (c) => c.json({ ok: true, task: "dns/apply" }));
  app.post("/workers/reconcile", (c) => c.json({ ok: true, task: "workers/reconcile" }));
  app.post("/pages/deploy", (c) => c.json({ ok: true, task: "pages/deploy" }));
  app.post("/access/audit", (c) => c.json({ ok: true, task: "access/audit" }));

  return app;
};

const app = createApp();

export default {
  async fetch(request: Request, env: ControlEnv, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
  async scheduled(
    _controller: ScheduledController,
    env: ControlEnv,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await env.CONTROL_LOGS.put(Date.now().toString(), "cron-scheduled-run");
  },
};
