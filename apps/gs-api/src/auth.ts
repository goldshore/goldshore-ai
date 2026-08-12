import { Context, Next } from "hono";
import {
  buildAdminSession,
  hasAdminPermission,
  type AccessTokenPayload,
  type AdminPermission
} from "@goldshore/auth";
import { Env, Variables, AuditEvent } from "./types";
import { validateSession, getSessionIdFromCookie, type SessionUser } from "./lib/sessions";

export type AuthContext = Context<{
  Bindings: Env;
  Variables: Variables;
}>;

export const getActor = (claims: AccessTokenPayload | null, request: Request) =>
  claims?.email ||
  request.headers.get("CF-Access-Authenticated-User-Email") ||
  request.headers.get("CF-Access-Authenticated-User-Id") ||
  "unknown";

export const logAdminAction = async (env: Env, entry: Omit<AuditEvent, "timestamp">) => {
  const timestamp = new Date().toISOString();
  const payload: AuditEvent = { ...entry, timestamp };
  if (!env?.PLATFORM_DB) {
    if (typeof env?.KV?.put === "function") {
      try {
        await env.KV.put(
          `audit:${timestamp}:${crypto.randomUUID()}`,
          JSON.stringify(payload),
          { expirationTtl: 60 * 60 * 24 * 30 }
        );
      } catch (error) {
        console.error("Failed to write audit event to KV", { action: entry.action, error });
      }
    }
    return payload;
  }
  try {
    await env.PLATFORM_DB.prepare(
      `INSERT INTO audit_events (id, occurred_at, actor, action, status, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), timestamp, entry.actor ?? "unknown", entry.action,
      entry.status, JSON.stringify(entry.metadata ?? {})).run();
  } catch (error) {
    console.error("Failed to write audit event", { action: entry.action, error });
  }
  return payload;
};

export const requirePermission =
  (permission: AdminPermission) =>
  async (c: AuthContext, next: Next) => {
    const session = buildAdminSession(c.get("accessClaims"));
    if (!hasAdminPermission(session.permissions, permission)) {
      await logAdminAction(c.env, {
        action: "admin.access.denied",
        actor: getActor(c.get("accessClaims"), c.req.raw),
        status: "denied",
        metadata: { permission }
      });
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };

export const requireUserSession = () =>
  async (c: AuthContext, next: Next) => {
    const sessionId = getSessionIdFromCookie(c.req.raw);

    if (!sessionId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const user = await validateSession(c.env.KV, sessionId);

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("user", user);
    await next();
  };

export const getUser = (c: AuthContext): SessionUser | null => {
  return c.get("user") || null;
};
