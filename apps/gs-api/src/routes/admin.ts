import { Hono } from "hono";
import {
  ADMIN_ROLES,
  type AdminRole
} from "@goldshore/auth";
import { getActor, logAdminAction, requirePermission } from "../auth";
import { Env, Variables, AuditEvent } from "../types";

type AdminUserRecord = {
  id: string;
  email: string;
  role: AdminRole;
  status: "active" | "invited" | "disabled";
  createdAt: string;
  updatedAt: string;
};

const admin = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * [SOP] Admin User Management & Audit
 * Handles internal permissions and tracks administrative activity.
 */

const listUsers = async (env: Env) => {
  const { keys } = await env.KV.list({ prefix: "admin:user:" });
  const records = await Promise.all(
    keys.map(async (key) => env.KV.get<AdminUserRecord>(key.name, "json"))
  );
  return records.filter(Boolean) as AdminUserRecord[];
};

const saveUser = async (env: Env, user: AdminUserRecord) => {
  await env.KV.put(`admin:user:${user.id}`, JSON.stringify(user));
  return user;
};

// --- Routes ---

admin.get("/users", requirePermission("users:read"), async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  const users = await listUsers(c.env);
  
  await logAdminAction(c.env, {
    action: "admin.users.list",
    actor,
    status: "success",
    metadata: { count: users.length }
  });
  
  return c.json(users);
});

admin.post("/users", requirePermission("users:manage"), async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  const payload = await c.req.json<{ email?: string; role?: AdminRole }>();
  
  if (!payload.email || !payload.role) {
    return c.json({ error: "Email and role are required." }, 400);
  }
  
  if (!ADMIN_ROLES.includes(payload.role)) {
    return c.json({ error: "Invalid role assignment." }, 400);
  }

  const now = new Date().toISOString();
  const user: AdminUserRecord = {
    id: crypto.randomUUID(),
    email: payload.email,
    role: payload.role,
    status: "invited",
    createdAt: now,
    updatedAt: now
  };

  await saveUser(c.env, user);
  
  await logAdminAction(c.env, {
    action: "admin.users.invite",
    actor,
    status: "success",
    metadata: { userId: user.id, role: user.role }
  });
  
  return c.json(user, 201);
});

admin.patch("/users/:id", requirePermission("users:manage"), async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  const { id } = c.req.param();
  const existing = await c.env.KV.get<AdminUserRecord>(`admin:user:${id}`, "json");
  
  if (!existing) {
    return c.json({ error: "User not found." }, 404);
  }

  const payload = await c.req.json<Partial<Pick<AdminUserRecord, "role" | "status">>>();
  
  const updated: AdminUserRecord = {
    ...existing,
    role: payload.role && ADMIN_ROLES.includes(payload.role as AdminRole) ? (payload.role as AdminRole) : existing.role,
    status: payload.status ?? existing.status,
    updatedAt: new Date().toISOString()
  };

  await saveUser(c.env, updated);
  
  await logAdminAction(c.env, {
    action: "admin.users.update",
    actor,
    status: "success",
    metadata: { userId: id, role: updated.role, status: updated.status }
  });
  
  return c.json(updated);
});

admin.get("/audit", requirePermission("audit:read"), async (c) => {
  const actor = getActor(c.get("accessClaims"), c.req.raw);
  const { keys } = await c.env.KV.list({ prefix: "audit:admin:" });
  
  const entries = await Promise.all(
    keys.map(async (key) => c.env.KV.get<AuditEvent>(key.name, "json"))
  );
  
  const logs = entries
    .filter(Boolean)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 50);

  await logAdminAction(c.env, {
    action: "admin.audit.list",
    actor,
    status: "success",
    metadata: { count: logs.length }
  });

  return c.json(logs);
});

export default admin;
