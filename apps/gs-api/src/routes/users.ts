import { Hono } from "hono";
import { buildAdminSession, hasAdminPermission } from "@goldshore/auth";
import type { Env, Variables } from "../types";

const users = new Hono<{ Bindings: Env; Variables: Variables }>();

users.get("/", async (c) => {
  const session = buildAdminSession(c.get("accessClaims"));
  if (!hasAdminPermission(session.permissions, "users:read")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 100);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
  const result = await c.env.PLATFORM_DB.prepare(
    `SELECT id, email, display_name, status, created_at, disabled_at
       FROM users
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
  ).bind(limit, offset).all();
  return c.json({ items: result.results ?? [], offset, limit });
});

users.get("/:id", async (c) => {
  const session = buildAdminSession(c.get("accessClaims"));
  if (!hasAdminPermission(session.permissions, "users:read")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const user = await c.env.PLATFORM_DB.prepare(
    `SELECT id, email, display_name, status, created_at, disabled_at
       FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
  ).bind(c.req.param("id")).first();
  if (!user) return c.json({ error: "Not found" }, 404);
  return c.json(user);
});

export default users;
