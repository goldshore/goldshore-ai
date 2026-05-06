import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AccessTokenPayload } from "@goldshore/auth";
import type { ControlEnv } from "../libs/types";
import { logAuditEvent } from "@goldshore/utils";

const DEFAULT_ADMIN_ROLES = ["admin", "ops", "owner", "infra"];

const dnsRecordSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  content: z.string().min(1),
  ttl: z.number().int().min(1),
  proxied: z.boolean().optional(),
  comment: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().int().optional(),
});

const getRequiredRoles = (env: ControlEnv) => {
  const configured = env.CONTROL_ADMIN_ROLES?.split(",").map((role) => role.trim()).filter(Boolean);
  return configured && configured.length > 0 ? configured : DEFAULT_ADMIN_ROLES;
};

const extractRoles = (claims: AccessTokenPayload) => {
  const roles = new Set<string>();
  const candidates = [claims.roles, claims.role, claims.groups];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      candidate.forEach((value) => roles.add(value));
    } else if (typeof candidate === "string") {
      roles.add(candidate);
    }
  }
  return Array.from(roles).map((role) => role.toLowerCase());
};

const isAuthorizedRole = (claims: AccessTokenPayload, requiredRoles: string[]) => {
  const roles = extractRoles(claims);
  if (roles.length === 0) {
    return false;
  }
  const required = requiredRoles.map((role) => role.toLowerCase());
  return roles.some((role) => required.includes(role));
};

const getActor = (claims: AccessTokenPayload, request: Request) => {
  return (
    claims.email ||
    request.headers.get("CF-Access-Authenticated-User-Email") ||
    request.headers.get("CF-Access-Authenticated-User-Id") ||
    "unknown"
  );
};

const fetchCloudflare = async (
  env: ControlEnv,
  path: string,
  init?: RequestInit
) => {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("Missing Cloudflare API credentials.");
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
};

const formatErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

export const cloudflareRoutes = new Hono<{
  Bindings: ControlEnv;
  Variables: {
    accessClaims: AccessTokenPayload;
  };
}>();

cloudflareRoutes.use("*", async (c, next) => {
  const claims = c.get("accessClaims");
  const requiredRoles = getRequiredRoles(c.env);
  if (!isAuthorizedRole(claims, requiredRoles)) {
    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:access-denied",
      actor: getActor(claims, c.req.raw),
      status: "denied",
      metadata: {
        requiredRoles,
        roles: extractRoles(claims)
      }
    });
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
});

cloudflareRoutes.get("/dns/records", async (c) => {
  const zoneId = c.env.CLOUDFLARE_ZONE_ID;
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  if (!zoneId) {
    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:dns:list",
      actor,
      status: "error",
      metadata: { reason: "missing-zone-id" }
    });
    return c.json({ error: "Missing Cloudflare zone id." }, 400);
  }

  const query = new URL(c.req.url).searchParams.toString();
  try {
    const result = await fetchCloudflare(
      c.env,
      `/zones/${zoneId}/dns_records${query ? `?${query}` : ""}`
    );

    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:dns:list",
      actor,
      status: result.ok ? "success" : "error",
      metadata: { status: result.status }
    });

    return c.json(result.data, result.status as ContentfulStatusCode);
  } catch (error) {
    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:dns:list",
      actor,
      status: "error",
      metadata: { message: formatErrorMessage(error) }
    });
    return c.json({ error: "Cloudflare API request failed." }, 502);
  }
});

cloudflareRoutes.put(
  "/dns/records/:recordId",
  zValidator("json", dnsRecordSchema),
  async (c) => {
    const zoneId = c.env.CLOUDFLARE_ZONE_ID;
    const { recordId } = c.req.param();
    const actor = getActor(c.get("accessClaims"), c.req.raw);

    if (!zoneId) {
      await logAuditEvent(c.env.CONTROL_LOGS, {
        action: "cloudflare:dns:update",
        actor,
        status: "error",
        metadata: { reason: "missing-zone-id" }
      });
      return c.json({ error: "Missing Cloudflare zone id." }, 400);
    }

    if (!recordId) {
      await logAuditEvent(c.env.CONTROL_LOGS, {
        action: "cloudflare:dns:update",
        actor,
        status: "error",
        metadata: { reason: "missing-record-id" }
      });
      return c.json({ error: "Missing DNS record id." }, 400);
    }

    // Validate recordId to prevent path traversal
    if (!/^[a-zA-Z0-9]+$/.test(recordId)) {
      await logAuditEvent(c.env.CONTROL_LOGS, {
        action: "cloudflare:dns:update",
        actor,
        status: "error",
        metadata: { reason: "invalid-record-id", recordId }
      });
      return c.json({ error: "Invalid DNS record id." }, 400);
    }

    try {
      const payload = c.req.valid("json");
      const result = await fetchCloudflare(
        c.env,
        `/zones/${zoneId}/dns_records/${recordId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload)
        }
      );

      await logAuditEvent(c.env.CONTROL_LOGS, {
        action: "cloudflare:dns:update",
        actor,
        status: result.ok ? "success" : "error",
        metadata: { status: result.status, recordId }
      });

      return c.json(result.data, result.status as ContentfulStatusCode);
    } catch (error) {
      await logAuditEvent(c.env.CONTROL_LOGS, {
        action: "cloudflare:dns:update",
        actor,
        status: "error",
        metadata: { recordId, message: formatErrorMessage(error) }
      });
      return c.json({ error: "Cloudflare API request failed." }, 502);
    }
  }
);

cloudflareRoutes.get("/workers/status", async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  try {
    const result = await fetchCloudflare(
      c.env,
      `/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/services`
    );

    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:workers:status",
      actor,
      status: result.ok ? "success" : "error",
      metadata: { status: result.status }
    });

    return c.json(result.data, result.status as ContentfulStatusCode);
  } catch (error) {
    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:workers:status",
      actor,
      status: "error",
      metadata: { message: formatErrorMessage(error) }
    });
    return c.json({ error: "Cloudflare API request failed." }, 502);
  }
});

cloudflareRoutes.get("/pages/projects", async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  try {
    const result = await fetchCloudflare(
      c.env,
      `/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/pages/projects`
    );

    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:pages:list",
      actor,
      status: result.ok ? "success" : "error",
      metadata: { status: result.status }
    });

    return c.json(result.data, result.status as ContentfulStatusCode);
  } catch (error) {
    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:pages:list",
      actor,
      status: "error",
      metadata: { message: formatErrorMessage(error) }
    });
    return c.json({ error: "Cloudflare API request failed." }, 502);
  }
});

cloudflareRoutes.get("/kv/namespaces", async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  try {
    const result = await fetchCloudflare(
      c.env,
      `/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`
    );

    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:kv:list",
      actor,
      status: result.ok ? "success" : "error",
      metadata: { status: result.status }
    });

    return c.json(result.data, result.status as ContentfulStatusCode);
  } catch (error) {
    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:kv:list",
      actor,
      status: "error",
      metadata: { message: formatErrorMessage(error) }
    });
    return c.json({ error: "Cloudflare API request failed." }, 502);
  }
});

cloudflareRoutes.get("/r2/buckets", async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  try {
    const result = await fetchCloudflare(
      c.env,
      `/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets`
    );

    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:r2:list",
      actor,
      status: result.ok ? "success" : "error",
      metadata: { status: result.status }
    });

    return c.json(result.data, result.status as ContentfulStatusCode);
  } catch (error) {
    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:r2:list",
      actor,
      status: "error",
      metadata: { message: formatErrorMessage(error) }
    });
    return c.json({ error: "Cloudflare API request failed." }, 502);
  }
});

cloudflareRoutes.get("/d1/databases", async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  try {
    const result = await fetchCloudflare(
      c.env,
      `/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/d1/database`
    );

    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:d1:list",
      actor,
      status: result.ok ? "success" : "error",
      metadata: { status: result.status }
    });

    return c.json(result.data, result.status as ContentfulStatusCode);
  } catch (error) {
    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:d1:list",
      actor,
      status: "error",
      metadata: { message: formatErrorMessage(error) }
    });
    return c.json({ error: "Cloudflare API request failed." }, 502);
  }
});

cloudflareRoutes.get("/access/policies", async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  const appId = c.req.query("appId");
  if (!appId) {
    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:access:policies",
      actor,
      status: "error",
      metadata: { reason: "missing-app-id" }
    });
    return c.json({ error: "Missing access app id." }, 400);
  }

  try {
    const result = await fetchCloudflare(
      c.env,
      `/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/access/apps/${appId}/policies`
    );

    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:access:policies",
      actor,
      status: result.ok ? "success" : "error",
      metadata: { status: result.status, appId }
    });

    return c.json(result.data, result.status as ContentfulStatusCode);
  } catch (error) {
    await logAuditEvent(c.env.CONTROL_LOGS, {
      action: "cloudflare:access:policies",
      actor,
      status: "error",
      metadata: { appId, message: formatErrorMessage(error) }
    });
    return c.json({ error: "Cloudflare API request failed." }, 502);
  }
});
