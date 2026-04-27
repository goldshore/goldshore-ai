import { Hono } from "hono";
import { buildAdminSession, hasAdminPermission, type AccessTokenPayload } from "@goldshore/auth";

type Env = Record<string, never>;

const users = new Hono<{ Bindings: Env; Variables: { accessClaims: AccessTokenPayload | null } }>();

users.get("/", async (c) => {
  const session = buildAdminSession(c.get("accessClaims"));
  if (!hasAdminPermission(session.permissions, "users:read")) {
    return c.json({ error: "Forbidden" }, 403);
  }
  return c.json([{ id: "1", email: "admin@goldshore.ai" }]);
});
users.get("/:id", async (c) => {
  const session = buildAdminSession(c.get("accessClaims"));
  if (!hasAdminPermission(session.permissions, "users:read")) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const id = c.req.param("id");
  return c.json({ id, email: `${id}@goldshore.ai` });
});

export default users;
