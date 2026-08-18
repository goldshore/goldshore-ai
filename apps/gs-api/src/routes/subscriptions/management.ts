import { Hono } from "hono";
import { SUBSCRIPTION_TIERS, TIER_DEFINITIONS } from "@goldshore/schema/subscription";
import { recordSubscriptionEvent } from "@goldshore/auth/subscription-rbac";
import type { Env, Variables } from "../../types";

const management = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// POST /subscriptions/manage/upgrade - Upgrade subscription tier
management.post("/upgrade", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json<{ newTier: string }>();
    const { newTier } = body;

    if (!SUBSCRIPTION_TIERS.includes(newTier as any)) {
      return c.json({ error: "Invalid tier" }, 400);
    }

    const db = c.env.PLATFORM_DB;
    const userId = claims.sub || claims.email;

    // Get current subscription
    const subscription = await db
      .prepare(
        `SELECT id, tier FROM subscriptions
         WHERE user_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(userId)
      .first<{ id: string; tier: string }>();

    if (!subscription) {
      return c.json({ error: "No active subscription found" }, 404);
    }

    const tiers = SUBSCRIPTION_TIERS as any[];
    const currentIndex = tiers.indexOf(subscription.tier);
    const newIndex = tiers.indexOf(newTier);

    if (newIndex <= currentIndex) {
      return c.json({ error: "Can only upgrade to a higher tier" }, 400);
    }

    // Update subscription tier
    await db
      .prepare(
        `UPDATE subscriptions
         SET tier = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(newTier, subscription.id)
      .run();

    await recordSubscriptionEvent(db, userId, subscription.id, "tier_upgrade", {
      fromTier: subscription.tier,
      toTier: newTier,
    });

    return c.json({
      success: true,
      message: "Subscription upgraded",
      subscriptionId: subscription.id,
      previousTier: subscription.tier,
      newTier,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[management] Error upgrading subscription:", msg);
    return c.json({ error: "Failed to upgrade subscription" }, 500);
  }
});

// POST /subscriptions/manage/downgrade - Downgrade subscription tier
management.post("/downgrade", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json<{ newTier: string }>();
    const { newTier } = body;

    if (!SUBSCRIPTION_TIERS.includes(newTier as any)) {
      return c.json({ error: "Invalid tier" }, 400);
    }

    const db = c.env.PLATFORM_DB;
    const userId = claims.sub || claims.email;

    // Get current subscription
    const subscription = await db
      .prepare(
        `SELECT id, tier FROM subscriptions
         WHERE user_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(userId)
      .first<{ id: string; tier: string }>();

    if (!subscription) {
      return c.json({ error: "No active subscription found" }, 404);
    }

    const tiers = SUBSCRIPTION_TIERS as any[];
    const currentIndex = tiers.indexOf(subscription.tier);
    const newIndex = tiers.indexOf(newTier);

    if (newIndex >= currentIndex) {
      return c.json({ error: "Can only downgrade to a lower tier" }, 400);
    }

    // Downgrade effective at end of billing cycle
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    await db
      .prepare(
        `UPDATE subscriptions
         SET tier = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(newTier, endDate.toISOString(), subscription.id)
      .run();

    await recordSubscriptionEvent(db, userId, subscription.id, "tier_downgrade", {
      fromTier: subscription.tier,
      toTier: newTier,
      effectiveDate: endDate.toISOString(),
    });

    return c.json({
      success: true,
      message: "Subscription downgraded (effective at end of billing cycle)",
      subscriptionId: subscription.id,
      previousTier: subscription.tier,
      newTier,
      effectiveDate: endDate.toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[management] Error downgrading subscription:", msg);
    return c.json({ error: "Failed to downgrade subscription" }, 500);
  }
});

// POST /subscriptions/manage/cancel - Cancel subscription
management.post("/cancel", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const db = c.env.PLATFORM_DB;
    const userId = claims.sub || claims.email;

    // Get current subscription
    const subscription = await db
      .prepare(
        `SELECT id, stripe_subscription_id FROM subscriptions
         WHERE user_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(userId)
      .first<{ id: string; stripe_subscription_id: string | null }>();

    if (!subscription) {
      return c.json({ error: "No active subscription found" }, 404);
    }

    // Cancel at end of billing cycle
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    await db
      .prepare(
        `UPDATE subscriptions
         SET status = 'cancelled', end_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(endDate.toISOString(), subscription.id)
      .run();

    // TODO: Cancel Stripe subscription if stripe_subscription_id exists
    // await stripe.subscriptions.del(subscription.stripe_subscription_id);

    await recordSubscriptionEvent(db, userId, subscription.id, "subscription_cancelled", {
      effectiveDate: endDate.toISOString(),
      stripeSubscriptionId: subscription.stripe_subscription_id,
    });

    return c.json({
      success: true,
      message: "Subscription cancelled (effective at end of billing cycle)",
      subscriptionId: subscription.id,
      endDate: endDate.toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[management] Error cancelling subscription:", msg);
    return c.json({ error: "Failed to cancel subscription" }, 500);
  }
});

// GET /subscriptions/manage/billing - Get billing information
management.get("/billing", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const db = c.env.PLATFORM_DB;
    const userId = claims.sub || claims.email;

    const subscription = await db
      .prepare(
        `SELECT id, tier, status, start_date, end_date, renewal_date, billing_cycle, stripe_subscription_id
         FROM subscriptions
         WHERE user_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(userId)
      .first<{
        id: string;
        tier: string;
        status: string;
        start_date: string;
        end_date: string | null;
        renewal_date: string | null;
        billing_cycle: string;
        stripe_subscription_id: string | null;
      }>();

    if (!subscription) {
      return c.json({ error: "No active subscription found" }, 404);
    }

    const tierDef = TIER_DEFINITIONS[subscription.tier as keyof typeof TIER_DEFINITIONS];
    const monthlyPrice = tierDef.monthlyPrice;
    const annualPrice = tierDef.annualPrice;

    return c.json({
      subscriptionId: subscription.id,
      tier: subscription.tier,
      status: subscription.status,
      billingCycle: subscription.billing_cycle,
      pricing: {
        monthly: monthlyPrice,
        annual: annualPrice,
        monthlyFormatted: `$${(monthlyPrice / 100).toFixed(2)}`,
        annualFormatted: `$${(annualPrice / 100).toFixed(2)}`,
      },
      dates: {
        startDate: subscription.start_date,
        renewalDate: subscription.renewal_date,
        endDate: subscription.end_date,
      },
      stripeSubscriptionId: subscription.stripe_subscription_id || null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[management] Error fetching billing info:", msg);
    return c.json({ error: "Failed to fetch billing information" }, 500);
  }
});

// POST /subscriptions/manage/billing-cycle - Update billing cycle (monthly to annual or vice versa)
management.post("/billing-cycle", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json<{ billingCycle: "monthly" | "annual" }>();
    const { billingCycle } = body;

    if (!["monthly", "annual"].includes(billingCycle)) {
      return c.json({ error: "Invalid billing cycle" }, 400);
    }

    const db = c.env.PLATFORM_DB;
    const userId = claims.sub || claims.email;

    const subscription = await db
      .prepare(
        `SELECT id, billing_cycle FROM subscriptions
         WHERE user_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(userId)
      .first<{ id: string; billing_cycle: string }>();

    if (!subscription) {
      return c.json({ error: "No active subscription found" }, 404);
    }

    if (subscription.billing_cycle === billingCycle) {
      return c.json(
        { error: `Already using ${billingCycle} billing cycle` },
        400
      );
    }

    // TODO: Update Stripe subscription if it exists
    // Effective at next renewal

    await db
      .prepare(
        `UPDATE subscriptions
         SET billing_cycle = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(billingCycle, subscription.id)
      .run();

    return c.json({
      success: true,
      message: `Billing cycle updated to ${billingCycle}`,
      subscriptionId: subscription.id,
      billingCycle,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[management] Error updating billing cycle:", msg);
    return c.json({ error: "Failed to update billing cycle" }, 500);
  }
});

// GET /subscriptions/manage/invoice-history - Get past invoices
management.get("/invoice-history", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const db = c.env.PLATFORM_DB;
    const userId = claims.sub || claims.email;

    // Get subscription events for billing events
    const events = await db
      .prepare(
        `SELECT e.id, e.event_type, e.metadata, e.created_at
         FROM subscription_events e
         WHERE e.user_id = ? AND e.event_type IN ('subscription_created', 'subscription_renewed', 'payment_failed')
         ORDER BY e.created_at DESC
         LIMIT 12`
      )
      .bind(userId)
      .all<{
        id: string;
        event_type: string;
        metadata: string;
        created_at: string;
      }>();

    return c.json({
      invoices: (events.results || []).map((e) => ({
        id: e.id,
        type: e.event_type,
        date: e.created_at,
        metadata: e.metadata ? JSON.parse(e.metadata) : {},
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[management] Error fetching invoice history:", msg);
    return c.json({ error: "Failed to fetch invoice history" }, 500);
  }
});

export default management;
