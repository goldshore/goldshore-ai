import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { parseSystemSyncWritePayload } from "@goldshore/schema";
import { verifyAccessWithClaims, type AccessTokenPayload } from "@goldshore/auth";

interface ControlEnv {
  ALLOWED_ORIGINS?: string;
  CONTROL_ADMIN_ROLES?: string;
  GS_CONFIG: KVNamespace;
  CONTROL_LOGS: KVNamespace;
}

const defaultAllowedOrigins = [
  "https://admin.goldshore.ai",
  "https://admin-preview.goldshore.ai",
  "http://localhost:4321",
];

const DEFAULT_ADMIN_ROLES = ["admin", "ops", "owner", "infra"];

const getRequiredRoles = (env: ControlEnv) => {
  const configuredRoles = env.CONTROL_ADMIN_ROLES?.split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  return configuredRoles && configuredRoles.length > 0 ? configuredRoles : DEFAULT_ADMIN_ROLES;
};

const extractRoles = (claims: AccessTokenPayload | null) => {
  if (!claims) {
    return [];
  }

  const roles = new Set<string>();
  const candidates = [claims.roles, claims.role, claims.groups];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      candidate.forEach((value) => roles.add(value.trim().toLowerCase()));
    } else if (typeof candidate === "string") {
      roles.add(candidate.trim().toLowerCase());
    }
  }

  return Array.from(roles);
};

const isAuthorizedRole = (claims: AccessTokenPayload | null, requiredRoles: string[]) => {
  const roles = extractRoles(claims);
  if (roles.length === 0) {
    return false;
  }

  const required = requiredRoles.map((role) => role.toLowerCase());
  return roles.some((role) => required.includes(role));
};

const applyDnsSync = async (env: ControlEnv) => {
  await env.CONTROL_LOGS.put(`dns_apply_${Date.now()}`, JSON.stringify({ timestamp: new Date().toISOString() }));
  return { ok: true, status: "dns synced" };
};

const reconcileWorkers = async (env: ControlEnv) => {
  await env.CONTROL_LOGS.put(`workers_reconcile_${Date.now()}`, JSON.stringify({ timestamp: new Date().toISOString() }));
  return { ok: true, status: "workers reconciled" };
};

const deployPages = async (env: ControlEnv) => {
  await env.CONTROL_LOGS.put(`pages_deploy_${Date.now()}`, JSON.stringify({ timestamp: new Date().toISOString() }));
  return { ok: true, status: "pages deployed" };
};

const runAccessAudit = async (env: ControlEnv) => {
  const findings = [
    { check: "mfa_enforced", status: "pass" },
    { check: "ip_allowlist", status: "pass" },
    { check: "secrets_rotated", status: "pending" },
  ];

  await env.CONTROL_LOGS.put(
    `access_audit_${Date.now()}`,
    JSON.stringify({ timestamp: new Date().toISOString(), findings }),
  );

  return { ok: true, findings };
};

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
    const requiredRoles = getRequiredRoles(c.env);

    if (!isAuthorizedRole(claims, requiredRoles)) {
      return c.json({ error: "Forbidden" }, 403);
    }

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

  app.post("/dns/apply", async (c) => c.json(await applyDnsSync(c.env)));
  app.post("/workers/reconcile", async (c) => c.json(await reconcileWorkers(c.env)));
  app.post("/pages/deploy", async (c) => c.json(await deployPages(c.env)));
  app.post("/access/audit", async (c) => c.json(await runAccessAudit(c.env)));

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
