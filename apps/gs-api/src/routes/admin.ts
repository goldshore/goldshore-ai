import { Hono } from "hono";
import { ADMIN_ROLES, type AdminPermission, type AdminRole } from "@goldshore/auth";
import { getActor, logAdminAction, requirePermission } from "../auth";
import { Env, Variables } from "../types";
import deploy from "./admin/index";
import repoHealth from "./admin/repo-health";

type UserRow = {
  id: string; email: string; display_name: string | null; status: string;
  created_at: string; updated_at: string; role: AdminRole | null;
};

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();
const validStatus = new Set(["active", "invited", "disabled"]);
const sensitiveOperations: Record<string, AdminPermission> = {
  "secret-rotation": "secret_metadata:rotate",
  "production-promotion": "deployments:promote",
  "dns-change": "cloudflare_inventory:manage",
  "access-change": "cloudflare_inventory:manage",
  "destructive-data": "approvals:execute"
};
const userSelect = `SELECT u.id,u.email,u.display_name,u.status,u.created_at,u.updated_at,r.name role
  FROM users u LEFT JOIN role_assignments ra ON ra.user_id=u.id AND ra.revoked_at IS NULL
  LEFT JOIN roles r ON r.id=ra.role_id WHERE u.deleted_at IS NULL`;

const audit = async (c: any, action: string, status: "success" | "denied" | "error", metadata: Record<string, unknown>) =>
  logAdminAction(c.env, { action, actor: getActor(c.get("accessClaims"), c.req.raw), status, metadata });

const getUser = async (env: Env, id: string) =>
  env.PLATFORM_DB.prepare(`${userSelect} AND u.id=?`).bind(id).first<UserRow>();

const assertOwnerSurvives = async (env: Env, user: UserRow, nextRole?: AdminRole, nextStatus?: string) => {
  if (user.role !== "owner" || (nextRole === "owner" && (nextStatus ?? user.status) === "active")) return true;
  const row = await env.PLATFORM_DB.prepare(`${userSelect} AND r.name='owner' AND u.status='active'`).all<UserRow>();
  return row.results.some((candidate) => candidate.id !== user.id);
};

const setRole = async (env: Env, userId: string, role: AdminRole, actor: string) => {
  const roleRow = await env.PLATFORM_DB.prepare("SELECT id FROM roles WHERE name=?").bind(role).first<{ id: string }>();
  if (!roleRow) throw new Error("Role seed is missing");
  await env.PLATFORM_DB.batch([
    env.PLATFORM_DB.prepare("UPDATE role_assignments SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL").bind(userId),
    env.PLATFORM_DB.prepare(`INSERT INTO role_assignments(id,user_id,role_id,assigned_by) VALUES(?,?,?,(SELECT id FROM users WHERE email=? COLLATE NOCASE))
      ON CONFLICT(user_id,role_id) DO UPDATE SET revoked_at=NULL,assigned_by=excluded.assigned_by,created_at=datetime('now')`)
      .bind(crypto.randomUUID(), userId, roleRow.id, actor)
  ]);
};

admin.get("/session", async (c) => {
  const claims = c.get("accessClaims");
  const { buildAdminSession } = await import("@goldshore/auth");
  return c.json({ ...buildAdminSession(claims), actor: getActor(claims, c.req.raw) });
});

admin.get("/users", requirePermission("users:read"), async (c) => {
  const users = await c.env.PLATFORM_DB.prepare(`${userSelect} ORDER BY u.created_at DESC`).all<UserRow>();
  await audit(c, "admin.users.list", "success", { count: users.results.length });
  return c.json(users.results);
});

admin.post("/users", requirePermission("users:create"), async (c) => {
  const payload = await c.req.json<{ email?: string; displayName?: string; role?: AdminRole }>();
  if (!payload.email || !payload.role || !ADMIN_ROLES.includes(payload.role)) return c.json({ error: "Valid email and role are required." }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await c.env.PLATFORM_DB.prepare("INSERT INTO users(id,email,display_name,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)")
      .bind(id, payload.email.trim().toLowerCase(), payload.displayName ?? null, now, now).run();
    await setRole(c.env, id, payload.role, getActor(c.get("accessClaims"), c.req.raw));
  } catch (error) {
    return c.json({ error: "A user with that email already exists." }, 409);
  }
  await audit(c, "admin.users.create", "success", { userId: id, role: payload.role });
  return c.json(await getUser(c.env, id), 201);
});

admin.post("/users/invite", requirePermission("users:invite"), async (c) => {
  const payload = await c.req.json<{ email?: string; role?: AdminRole }>();
  if (!payload.email || !payload.role || !ADMIN_ROLES.includes(payload.role)) return c.json({ error: "Valid email and role are required." }, 400);
  const userId = crypto.randomUUID();
  const invitationId = crypto.randomUUID();
  const token = crypto.randomUUID() + crypto.randomUUID();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const role = await c.env.PLATFORM_DB.prepare("SELECT id FROM roles WHERE name=?").bind(payload.role).first<{ id: string }>();
  if (!role) return c.json({ error: "Role not found." }, 400);
  try {
    await c.env.PLATFORM_DB.batch([
      c.env.PLATFORM_DB.prepare("INSERT INTO users(id,email,status) VALUES(?,?,'invited')").bind(userId, payload.email.trim().toLowerCase()),
      c.env.PLATFORM_DB.prepare("INSERT INTO role_assignments(id,user_id,role_id) VALUES(?,?,?)").bind(crypto.randomUUID(), userId, role.id),
      c.env.PLATFORM_DB.prepare("INSERT INTO invitations(id,email,role_id,token_hash,invited_by,expires_at) VALUES(?,?,?,?,(SELECT id FROM users WHERE email=? COLLATE NOCASE),datetime('now','+7 days'))")
        .bind(invitationId, payload.email.trim().toLowerCase(), role.id, tokenHash, getActor(c.get("accessClaims"), c.req.raw))
    ]);
  } catch { return c.json({ error: "A user or pending invitation already exists." }, 409); }
  await audit(c, "admin.users.invite", "success", { userId, invitationId, role: payload.role });
  // The raw token is returned once for the mail delivery layer; only its hash is durable.
  return c.json({ user: await getUser(c.env, userId), invitation: { id: invitationId, token } }, 201);
});

admin.patch("/users/:id", requirePermission("users:update"), async (c) => {
  const existing = await getUser(c.env, c.req.param("id"));
  if (!existing) return c.json({ error: "User not found." }, 404);
  const payload = await c.req.json<{ displayName?: string; role?: AdminRole; status?: string }>();
  if (payload.role && !ADMIN_ROLES.includes(payload.role)) return c.json({ error: "Invalid role." }, 400);
  if (payload.status && !validStatus.has(payload.status)) return c.json({ error: "Invalid status." }, 400);
  if (!(await assertOwnerSurvives(c.env, existing, payload.role, payload.status))) return c.json({ error: "The final active owner cannot be demoted or disabled." }, 409);
  if (payload.role && payload.role !== existing.role) await setRole(c.env, existing.id, payload.role, getActor(c.get("accessClaims"), c.req.raw));
  await c.env.PLATFORM_DB.prepare("UPDATE users SET display_name=COALESCE(?,display_name),status=COALESCE(?,status),disabled_at=CASE WHEN ?='disabled' THEN datetime('now') ELSE disabled_at END,updated_at=datetime('now') WHERE id=?")
    .bind(payload.displayName ?? null, payload.status ?? null, payload.status ?? null, existing.id).run();
  await audit(c, "admin.users.update", "success", { userId: existing.id, role: payload.role, status: payload.status });
  return c.json(await getUser(c.env, existing.id));
});

admin.post("/users/:id/disable", requirePermission("users:disable"), async (c) => {
  const user = await getUser(c.env, c.req.param("id"));
  if (!user) return c.json({ error: "User not found." }, 404);
  if (!(await assertOwnerSurvives(c.env, user, user.role ?? undefined, "disabled"))) return c.json({ error: "The final active owner cannot be disabled." }, 409);
  await c.env.PLATFORM_DB.prepare("UPDATE users SET status='disabled',disabled_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(user.id).run();
  await c.env.PLATFORM_DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL").bind(user.id).run();
  await audit(c, "admin.users.disable", "success", { userId: user.id });
  return c.json(await getUser(c.env, user.id));
});

admin.delete("/users/:id", requirePermission("users:delete"), async (c) => {
  const user = await getUser(c.env, c.req.param("id"));
  if (!user) return c.json({ error: "User not found." }, 404);
  if (!(await assertOwnerSurvives(c.env, user, user.role ?? undefined, "deprovisioned"))) return c.json({ error: "The final active owner cannot be deleted." }, 409);
  await c.env.PLATFORM_DB.batch([
    c.env.PLATFORM_DB.prepare("UPDATE users SET status='deprovisioned',deleted_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(user.id),
    c.env.PLATFORM_DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL").bind(user.id),
    c.env.PLATFORM_DB.prepare("UPDATE role_assignments SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL").bind(user.id)
  ]);
  await audit(c, "admin.users.deprovision", "success", { userId: user.id });
  return c.body(null, 204);
});

admin.get("/audit", requirePermission("audit:read"), async (c) => {
  const logs = await c.env.PLATFORM_DB.prepare("SELECT id,occurred_at timestamp,actor,action,status,target_type,target_id,metadata_json FROM audit_events ORDER BY occurred_at DESC LIMIT 100").all();
  return c.json(logs.results);
});

admin.post("/approvals", requirePermission("approvals:create"), async (c) => {
  const payload = await c.req.json<{ operation?: string; resourceId?: string; request?: unknown }>();
  if (!payload.operation || !sensitiveOperations[payload.operation]) return c.json({ error: "Unsupported protected operation." }, 400);
  const id = crypto.randomUUID();
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  await c.env.PLATFORM_DB.prepare("INSERT INTO approvals(id,operation,resource_id,request_json,requested_by,expires_at) VALUES(?,?,?,?,?,datetime('now','+30 minutes'))")
    .bind(id, payload.operation, payload.resourceId ?? null, JSON.stringify(payload.request ?? {}), actor).run();
  await audit(c, "admin.approval.request", "success", { approvalId: id, operation: payload.operation });
  return c.json({ id, status: "pending" }, 201);
});

admin.post("/approvals/:id/approve", requirePermission("approvals:approve"), async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  const result = await c.env.PLATFORM_DB.prepare("UPDATE approvals SET approved_by=?,status='approved',approved_at=datetime('now') WHERE id=? AND status='pending' AND requested_by<>? AND expires_at>datetime('now')")
    .bind(actor, c.req.param("id"), actor).run();
  if (!result.meta.changes) return c.json({ error: "Approval must be current and supplied by a different operator." }, 409);
  await audit(c, "admin.approval.approve", "success", { approvalId: c.req.param("id") });
  return c.json({ id: c.req.param("id"), status: "approved" });
});

admin.post("/operations/:operation", async (c, next) => {
  const operation = c.req.param("operation");
  const permission = sensitiveOperations[operation];
  if (!permission) return c.json({ error: "Unsupported protected operation." }, 404);
  return requirePermission(permission)(c, next);
}, async (c) => {
  const claims = c.get("accessClaims");
  const assurance = typeof claims?.acr === "string" ? claims.acr.toLowerCase() : "";
  const authTime = typeof claims?.auth_time === "number" ? claims.auth_time * 1000 : 0;
  const steppedUp = /mfa|multi-factor|urn:goldshore:aal2/.test(assurance);
  if (!steppedUp || !authTime || Date.now() - authTime > 5 * 60_000 || authTime > Date.now() + 30_000) {
    return c.json({ error: "Recent step-up authentication is required." }, 401);
  }
  const payload = await c.req.json<{ approvalId?: string }>();
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  const approval = payload.approvalId && await c.env.PLATFORM_DB.prepare("SELECT id FROM approvals WHERE id=? AND operation=? AND status='approved' AND approved_by<>? AND requested_by=? AND expires_at>datetime('now')")
    .bind(payload.approvalId, c.req.param("operation"), actor, actor).first<{ id: string }>();
  if (!approval) return c.json({ error: "A current approval from a second operator is required." }, 403);
  await c.env.PLATFORM_DB.prepare("UPDATE approvals SET status='executed',executed_at=datetime('now') WHERE id=?").bind(approval.id).run();
  await audit(c, `admin.operation.${c.req.param("operation")}`, "success", { approvalId: approval.id });
  return c.json({ authorized: true, approvalId: approval.id });
});

admin.route("/deploy", deploy);
export default admin;
