import { Hono } from "hono";
import { TIER_DEFINITIONS, SUBSCRIPTION_TIERS } from "@packages/schema/src/subscription";
import { recordSubscriptionEvent } from "@packages/auth/subscription-rbac";
import type { Env, Variables } from "../../types";

const checkout = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// POST /subscriptions/checkout/session - Create a checkout session
checkout.post("/session", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json<{
      tier: string;
      billingCycle: "monthly" | "annual";
    }>();

    const { tier, billingCycle } = body;

    if (!SUBSCRIPTION_TIERS.includes(tier as any)) {
      return c.json({ error: "Invalid tier" }, 400);
    }

    const tierDef = TIER_DEFINITIONS[tier as keyof typeof TIER_DEFINITIONS];

    // Check if user already has an active subscription
    const db = c.env.PLATFORM_DB;
    const existingSubscription = await db
      .prepare(
        `SELECT id, tier, status FROM subscriptions
         WHERE user_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(claims.sub || claims.email)
      .first<{ id: string; tier: string; status: string }>();

    // For free tier, create subscription directly without Stripe
    if (tier === "free") {
      const subscriptionId = crypto.randomUUID();

      await db
        .prepare(
          `INSERT INTO subscriptions (id, user_id, tier, status, billing_cycle)
           VALUES (?, ?, ?, 'active', ?)`
        )
        .bind(subscriptionId, claims.sub || claims.email, tier, "monthly")
        .run();

      // Create usage tracking record
      const usageId = crypto.randomUUID();
      const currentMonth = new Date().toISOString().split("T")[0].slice(0, 7);
      await db
        .prepare(
          `INSERT INTO subscription_usage (id, subscription_id, month)
           VALUES (?, ?, ?)`
        )
        .bind(usageId, subscriptionId, currentMonth)
        .run();

      await recordSubscriptionEvent(
        db,
        claims.sub || claims.email,
        subscriptionId,
        "subscription_created",
        { tier, billingCycle }
      );

      return c.json({
        success: true,
        message: "Free subscription activated",
        subscriptionId,
        tier,
      });
    }

    // TODO: For paid tiers, create Stripe checkout session
    // This requires Stripe API integration
    const price = billingCycle === "annual" ? tierDef.annualPrice : tierDef.monthlyPrice;

    return c.json({
      success: false,
      error: "Paid subscriptions not yet implemented",
      message: "Free tier is available. Paid tiers (Starter, Pro, Enterprise) coming soon",
      tier,
      price: `${price / 100} USD per ${billingCycle}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[checkout] Error creating session:", msg);
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
});

// POST /subscriptions/checkout/confirm - Confirm checkout (Stripe webhook handler)
checkout.post("/confirm", async (c) => {
  try {
    const body = await c.req.json<{
      sessionId: string;
      stripeSubscriptionId: string;
      userId: string;
      tier: string;
    }>();

    const { sessionId, stripeSubscriptionId, userId, tier } = body;

    if (!sessionId || !stripeSubscriptionId || !userId || !tier) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const db = c.env.PLATFORM_DB;
    const subscriptionId = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO subscriptions (id, user_id, tier, status, stripe_subscription_id, billing_cycle)
         VALUES (?, ?, ?, 'active', ?, 'monthly')`
      )
      .bind(subscriptionId, userId, tier, stripeSubscriptionId)
      .run();

    // Create usage tracking record
    const usageId = crypto.randomUUID();
    const currentMonth = new Date().toISOString().split("T")[0].slice(0, 7);
    await db
      .prepare(
        `INSERT INTO subscription_usage (id, subscription_id, month)
         VALUES (?, ?, ?)`
      )
      .bind(usageId, subscriptionId, currentMonth)
      .run();

    await recordSubscriptionEvent(db, userId, subscriptionId, "subscription_created", {
      tier,
      stripeSubscriptionId,
    });

    return c.json({
      success: true,
      message: "Subscription confirmed",
      subscriptionId,
      tier,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[checkout] Error confirming subscription:", msg);
    return c.json({ error: "Failed to confirm subscription" }, 500);
  }
});

// GET /subscriptions/checkout/price - Get pricing for a tier
checkout.get("/price", async (c) => {
  try {
    const tier = c.req.query("tier") as string;
    const billingCycle = (c.req.query("cycle") as "monthly" | "annual") || "monthly";

    if (!tier || !SUBSCRIPTION_TIERS.includes(tier as any)) {
      return c.json({ error: "Invalid tier" }, 400);
    }

    const tierDef = TIER_DEFINITIONS[tier as keyof typeof TIER_DEFINITIONS];
    const price = billingCycle === "annual" ? tierDef.annualPrice : tierDef.monthlyPrice;

    return c.json({
      tier,
      billingCycle,
      price,
      priceFormatted: `$${(price / 100).toFixed(2)}`,
      features: tierDef.features.slice(0, 5),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[checkout] Error fetching price:", msg);
    return c.json({ error: "Failed to fetch price" }, 500);
  }
});

export default checkout;
