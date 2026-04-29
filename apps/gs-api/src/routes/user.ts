import { Hono } from "hono";
import { requirePermission } from "../auth";
import { Env, Variables } from "../types";

const user = new Hono<{ Bindings: Env; Variables: Variables }>();

user.get("/:id", requirePermission("users:read"), async (c) => {
  const id = c.req.param("id");
  c.header("Deprecation", "true");
  c.header("Sunset", "Wed, 01 Jul 2026 00:00:00 GMT");
  c.header("Link", `</users/${id}>; rel=\"successor-version\"`);
  return c.redirect(`/users/${id}`, 308);
});

export default user;
