import { Hono } from "hono";
import { buildSubscriptionSession } from "@packages/auth/subscription-rbac";
import type { Env, Variables } from "../../types";
import plans from "./plans";
import checkout from "./checkout";
import management from "./management";
import verification from "./verification";

const subscriptions = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Mount sub-routers
subscriptions.route("/plans", plans);
subscriptions.route("/checkout", checkout);
subscriptions.route("/manage", management);
subscriptions.route("/verify", verification);

// GET /subscriptions/current - Get current user's subscription
subscriptions.get("/current", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = c.req.query("user_id") || claims.sub;
  if (!userId) {
    return c.json({ error: "User ID required" }, 400);
  }

  const db = c.env.PLATFORM_DB;

  try {
    const session = await buildSubscriptionSession(claims, db, userId);
    if (!session) {
      return c.json({ error: "Could not build session" }, 500);
    }

    const subscription = await db
      .prepare(
        `SELECT id, tier, status, start_date, end_date, renewal_date, billing_cycle
         FROM subscriptions WHERE id = ?`
      )
      .bind(session.subscriptionId)
      .first<{
        id: string;
        tier: string;
        status: string;
        start_date: string;
        end_date: string | null;
        renewal_date: string | null;
        billing_cycle: string;
      }>();

    return c.json({
      subscription: {
        id: session.subscriptionId,
        tier: session.tier,
        status: session.subscriptionStatus,
        startDate: subscription?.start_date,
        endDate: subscription?.end_date,
        renewalDate: subscription?.renewal_date,
        billingCycle: subscription?.billing_cycle,
      },
      permissions: session.tierPermissions,
      verificationMethods: session.verificationMethods,
      isVerified: session.isVerified,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[subscriptions] Error fetching current subscription:", msg);
    return c.json({ error: "Failed to fetch subscription" }, 500);
  }
});

// GET /subscriptions/quota - Get usage quota for current month
subscriptions.get("/quota", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = c.req.query("user_id") || claims.sub;
  if (!userId) {
    return c.json({ error: "User ID required" }, 400);
  }

  const db = c.env.PLATFORM_DB;

  try {
    const subscription = await db
      .prepare("SELECT id, tier FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
      .bind(userId)
      .first<{ id: string; tier: string }>();

    if (!subscription) {
      return c.json({ quotaRemaining: { apiCalls: 1000, storage: 1, projects: 1, users: 1 } });
    }

    const currentMonth = new Date().toISOString().split("T")[0].slice(0, 7);
    const usage = await db
      .prepare(
        `SELECT api_calls_used, storage_used_gb, projects_created, users_invited
         FROM subscription_usage WHERE subscription_id = ? AND month = ?`
      )
      .bind(subscription.id, currentMonth)
      .first<{
        api_calls_used: number;
        storage_used_gb: number;
        projects_created: number;
        users_invited: number;
      }>();

    // Import TIER_DEFINITIONS here to avoid circular deps
    const TIER_DEFINITIONS = {
      free: { maxApiCalls: 1000, maxStorageGb: 1, maxProjects: 1, maxUsers: 1 },
      starter: { maxApiCalls: 50000, maxStorageGb: 10, maxProjects: 5, maxUsers: 3 },
      pro: { maxApiCalls: 500000, maxStorageGb: 100, maxProjects: 25, maxUsers: 10 },
      enterprise: { maxApiCalls: 999999999, maxStorageGb: 1000, maxProjects: 999, maxUsers: 999 },
    };

    const tier = TIER_DEFINITIONS[subscription.tier as keyof typeof TIER_DEFINITIONS] || TIER_DEFINITIONS.free;

    return c.json({
      tier: subscription.tier,
      quotaRemaining: {
        apiCalls: Math.max(0, tier.maxApiCalls - (usage?.api_calls_used ?? 0)),
        storage: Math.max(0, tier.maxStorageGb - (usage?.storage_used_gb ?? 0)),
        projects: Math.max(0, tier.maxProjects - (usage?.projects_created ?? 0)),
        users: Math.max(0, tier.maxUsers - (usage?.users_invited ?? 0)),
      },
      quotaUsed: {
        apiCalls: usage?.api_calls_used ?? 0,
        storage: usage?.storage_used_gb ?? 0,
        projects: usage?.projects_created ?? 0,
        users: usage?.users_invited ?? 0,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[subscriptions] Error fetching quota:", msg);
    return c.json({ error: "Failed to fetch quota" }, 500);
  }
});

export default subscriptions;
