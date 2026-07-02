import { Hono } from "hono";
import { Env, Variables } from "../types";

// Proxy integration requests to gs-admin backend
// All integration management routes are handled by gs-admin which maintains
// the integration registry, KV storage, and authentication state

const integrations = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// GET /integrations?action=list|definitions|status|sync
integrations.get("/", async (c) => {
  const action = c.req.query("action") || "list";
  const adminUrl = c.env.ADMIN_URL || "https://admin.goldshore.ai";

  try {
    const response = await fetch(`${adminUrl}/api/integrations/manage?action=${encodeURIComponent(action)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    return c.json(data, response.status as any);
  } catch (error) {
    console.error("Integration proxy error:", error);
    return c.json({ error: "Failed to process request" }, 500);
  }
});

// POST /integrations - Create or delete integrations
integrations.post("/", async (c) => {
  const adminUrl = c.env.ADMIN_URL || "https://admin.goldshore.ai";

  try {
    const body = await c.req.json();

    const response = await fetch(`${adminUrl}/api/integrations/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return c.json(data, response.status as any);
  } catch (error) {
    console.error("Integration operation proxy error:", error);
    return c.json({ error: "Failed to process request" }, 500);
  }
});

export default integrations;
