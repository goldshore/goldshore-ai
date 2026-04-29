import { Hono } from "hono";

const user = new Hono();

user.get("/:id", async (c) => {
  const id = c.req.param("id");
  c.header("Deprecation", "true");
  c.header("Sunset", "Wed, 01 Jul 2026 00:00:00 GMT");
  c.header("Link", `</users/${id}>; rel=\"successor-version\"`);
  return c.redirect(`/users/${id}`, 308);
});

export default user;
