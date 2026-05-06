import { Context, Next } from "hono";
import {
  buildAdminSession,
  hasAdminPermission,
  type AccessTokenPayload,
  type AdminPermission
} from "@goldshore/auth";
import { Env, Variables, AuditEvent } from "./types";

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
  const key = `audit:admin:${timestamp}:${crypto.randomUUID()}`;
  const payload: AuditEvent = { ...entry, timestamp };
  await env.KV.put(key, JSON.stringify(payload));
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
