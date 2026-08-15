import { Hono } from "hono";
import { TIER_DEFINITIONS, SUBSCRIPTION_TIERS } from "@packages/schema/src/subscription";
import type { Env, Variables } from "../../types";

const plans = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// GET /subscriptions/plans - List all subscription tiers
plans.get("/", async (c) => {
  try {
    const plansData = SUBSCRIPTION_TIERS.map((tier) => {
      const def = TIER_DEFINITIONS[tier];
      return {
        tier,
        name: def.name,
        description: def.description,
        pricing: {
          monthly: def.monthlyPrice,
          annual: def.annualPrice,
          savings: def.annualPrice > 0 ? Math.round((1 - def.annualPrice / (def.monthlyPrice * 12)) * 100) : 0,
        },
        limits: {
          maxUsers: def.maxUsers,
          maxProjects: def.maxProjects,
          maxApiCalls: def.maxApiCalls,
          maxStorageGb: def.maxStorageGb,
        },
        features: def.features,
        permissions: def.permissions,
      };
    });

    return c.json({ plans: plansData });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[plans] Error listing plans:", msg);
    return c.json({ error: "Failed to list plans" }, 500);
  }
});

// GET /subscriptions/plans/:tier - Get specific tier details
plans.get("/:tier", async (c) => {
  const tier = c.req.param("tier") as keyof typeof TIER_DEFINITIONS;

  if (!SUBSCRIPTION_TIERS.includes(tier as any)) {
    return c.json({ error: "Invalid tier" }, 400);
  }

  const def = TIER_DEFINITIONS[tier];

  return c.json({
    tier,
    name: def.name,
    description: def.description,
    pricing: {
      monthly: def.monthlyPrice,
      annual: def.annualPrice,
      savingsPercent: def.annualPrice > 0 ? Math.round((1 - def.annualPrice / (def.monthlyPrice * 12)) * 100) : 0,
    },
    limits: {
      maxUsers: def.maxUsers,
      maxProjects: def.maxProjects,
      maxApiCalls: def.maxApiCalls,
      maxStorageGb: def.maxStorageGb,
    },
    features: def.features,
    permissions: def.permissions,
    comparisonTable: SUBSCRIPTION_TIERS.map((t) => ({
      tier: t,
      included: def.features.length > 0,
    })),
  });
});

// POST /subscriptions/plans/compare - Compare multiple tiers
plans.post("/compare", async (c) => {
  try {
    const body = await c.req.json<{ tiers?: string[] }>();
    const tierList = body.tiers || SUBSCRIPTION_TIERS;

    const comparison = tierList
      .filter((t): t is typeof SUBSCRIPTION_TIERS[number] => SUBSCRIPTION_TIERS.includes(t as any))
      .map((tier) => {
        const def = TIER_DEFINITIONS[tier];
        return {
          tier,
          name: def.name,
          monthlyPrice: def.monthlyPrice,
          annualPrice: def.annualPrice,
          limits: {
            users: def.maxUsers,
            projects: def.maxProjects,
            apiCalls: def.maxApiCalls,
            storage: def.maxStorageGb,
          },
          featureCount: def.features.length,
          topFeatures: def.features.slice(0, 5),
        };
      });

    return c.json({ comparison });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[plans] Error comparing tiers:", msg);
    return c.json({ error: "Failed to compare tiers" }, 400);
  }
});

export default plans;
