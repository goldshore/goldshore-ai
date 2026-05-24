import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AccessTokenPayload } from "@goldshore/auth";
import type { ControlEnv } from "../libs/types";
import { extractRoles, getRequiredRoles, isAuthorizedRole } from "../libs/adminAuth";
import { logAuditEvent } from "@goldshore/utils";

const editableDnsRecordFields = {
  type: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  content: z.string().min(1),
  ttl: z.number().int().min(1).optional(),
  proxied: z.boolean().optional(),
  comment: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().int().optional(),
};

const dnsRecordTransformer = z.object(editableDnsRecordFields).passthrough().transform((record) => ({
  type: record.type,
  name: record.name,
  content: record.content,
  ttl: record.ttl,
  proxied: record.proxied,
  comment: record.comment,
  tags: record.tags,
  priority: record.priority,
}));

type EditableDnsRecordKey = keyof typeof editableDnsRecordFields;

const editableDnsRecordKeys = Object.keys(editableDnsRecordFields) as EditableDnsRecordKey[];

const dnsRecordSchema = dnsRecordTransformer
  .transform((payload) =>
    Object.fromEntries(
      editableDnsRecordKeys
        .filter((key) => payload[key as EditableDnsRecordKey] !== undefined)
        .map((key) => [key, payload[key as EditableDnsRecordKey]])
    ) as Partial<Record<EditableDnsRecordKey, unknown>>
  );

const dnsQuerySchema = z.object({
  match: z.enum(["any", "all"]).optional(),
  name: z.string().optional(),
  "name.contains": z.string().optional(),
  "name.endswith": z.string().optional(),
  "name.startswith": z.string().optional(),
  order: z.enum(["type", "name", "content", "ttl", "proxied"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(100).optional(),
  proxied: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  search: z.string().optional(),
  type: z.string().optional(),
  tag: z.string().optional(),
  "tag.contains": z.string().optional(),
  "tag.endswith": z.string().optional(),
  "tag.startswith": z.string().optional(),
  direction: z.enum(["asc", "desc"]).optional(),
}).strip();

const accessPolicyQuerySchema = z.object({
  appId: z.string().regex(/^[a-zA-Z0-9-]+$/),
}).strip();

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

cloudflareRoutes.get("/dns/records", zValidator("query", dnsQuerySchema), async (c) => {
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

  try {
    const validatedQuery = c.req.valid("query");
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(validatedQuery)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();

    const result = await fetchCloudflare(
      c.env,
      `/zones/${zoneId}/dns_records${queryString ? `?${queryString}` : ""}`
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

cloudflareRoutes.get("/access/policies", zValidator("query", accessPolicyQuerySchema), async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  const { appId } = c.req.valid("query");

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
