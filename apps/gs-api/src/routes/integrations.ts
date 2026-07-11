import { Hono } from "hono";
import { getIntegrationRegistry, INTEGRATION_DEFINITIONS } from "../lib/IntegrationRegistry";
import { Env, Variables } from "../types";
import { requirePermission, getActor } from "../auth";
import { buildAdminSession, hasAdminPermission } from "@goldshore/auth";
import integrationKeys from "./integration-keys";
import whatsappCommands from "./whatsapp-commands";
import oauth from "./oauth";

const integrations = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * Integration Management API
 * Terminal endpoint for third-party integration lifecycle: CRUD, sync, status monitoring
 */

// GET /integrations?action=list|definitions|status|sync
integrations.get("/", async (c) => {
  const action = c.req.query("action") || "list";
  const kv = c.env.KV;

  try {
    const registry = getIntegrationRegistry(kv);
    await registry.loadFromStorage();

    switch (action) {
      case "list": {
        const metrics = await registry.getDashboardMetrics();
        return c.json({ success: true, data: metrics });
      }

      case "definitions": {
        return c.json({ success: true, data: INTEGRATION_DEFINITIONS });
      }

      case "sync": {
        const session = buildAdminSession(c.get("accessClaims"));
        if (!hasAdminPermission(session.permissions, "system:integrations:manage")) {
          return c.json({ error: "Forbidden" }, 403);
        }
        const results = await registry.syncAll();
        return c.json({ success: true, data: results });
      }

      case "status": {
        const statuses = await registry.getRedactedStatuses();
        return c.json({ success: true, data: statuses });
      }

      default:
        return c.json({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    console.error("Integration management error:", error);
    return c.json({ error: "Failed to process request" }, 500);
  }
});

// POST /integrations - Create or delete integrations (requires system:integrations:manage permission)
integrations.post("/", requirePermission("system:integrations:manage"), async (c) => {
  const kv = c.env.KV;

  if (!kv) {
    return c.json({ error: "Storage unavailable" }, 503);
  }

  try {
    const body = await c.req.json<{
      action: string;
      config?: Record<string, unknown>;
    }>();

    const { action, config } = body;

    if (action === "create" && config) {
      const registry = getIntegrationRegistry(kv);
      const integration = registry.createIntegration(config as any);

      // Test connection
      const connected = await integration.authenticate();

      if (typeof (kv as any).put === "function") {
        await (kv as any).put(
          `integration:${config.name}`,
          JSON.stringify(config),
          { expirationTtl: 365 * 24 * 60 * 60 }
        );
      }

      return c.json(
        {
          success: true,
          data: {
            name: config.name,
            connected,
            message: connected
              ? "Integration created and connected"
              : "Integration created but authentication failed",
          },
        },
        201
      );
    }

    if (action === "delete" && config?.name) {
      if (typeof (kv as any).delete === "function") {
        await (kv as any).delete(`integration:${config.name}`);
      }

      // Remove from registry cache
      const registry = getIntegrationRegistry(kv);
      registry.getAll().delete(config.name as string);

      return c.json({
        success: true,
        message: "Integration deleted",
      });
    }

    return c.json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Integration operation error:", error);
    return c.json({ error: "Failed to process request" }, 500);
  }
});

// Mount secret management routes at /integrations/keys
integrations.route("/keys", integrationKeys);

// Mount WhatsApp command handler routes at /integrations/whatsapp
integrations.route("/whatsapp", whatsappCommands);

// Mount OAuth routes at /integrations/oauth
integrations.route("/oauth", oauth);

export default integrations;
