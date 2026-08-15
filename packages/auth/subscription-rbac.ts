import type { SubscriptionTier } from "@goldshore/schema/subscription";
import { TIER_DEFINITIONS } from "@goldshore/schema/subscription";
import type { AccessTokenPayload } from "./verify";
import type { AdminPermission } from "./rbac";

/** Extended session that includes subscription context */
export interface SubscriptionSession {
  userId: string;
  email: string;
  tier: SubscriptionTier;
  subscriptionId: string;
  subscriptionStatus: "active" | "cancelled" | "expired" | "suspended";
  permissions: (AdminPermission | SubscriptionPermission)[];
  rolPermissions: AdminPermission[];
  tierPermissions: SubscriptionPermission[];
  verificationMethods: string[]; // ['email', 'google_oauth', etc]
  isVerified: boolean;
}

export type SubscriptionPermission = (typeof SUBSCRIPTION_PERMISSIONS)[number];

/** Tier-based permissions derived from tier features */
export const SUBSCRIPTION_PERMISSIONS = [
  // Feature access permissions
  "api:read:limited",
  "api:read",
  "api:write",
  "api:admin",
  "api:management",
  "dashboard:read",
  "dashboard:write",
  "dashboard:admin",
  "content:read",
  "content:write",
  "content:publish",
  "forms:read",
  "forms:create",
  "forms:update",
  "forms:publish",
  "forms:admin",
  "analytics:read:basic",
  "analytics:read:advanced",
  "analytics:write",
  "analytics:admin",
  "integrations:read",
  "integrations:create",
  "integrations:admin",
  "sso:manage",
  "sso:admin",
  "webhooks:manage",
  "webhooks:admin",
  "collaborators:invite",
  "collaborators:admin",
  "audit:read",
  "audit:admin",
  "billing:manage",
  "organization:admin",
  // Rate limit permissions
  "api:high_volume",
  "storage:expanded",
  "concurrent_projects:multiple",
  "team_collaboration:enabled",
  // Enterprise features
  "white_label:enabled",
  "saml:enabled",
  "data_residency:configurable",
  "sla:guaranteed",
] as const;

/** Map subscription tier to permission list */
export const getTierPermissions = (
  tier: SubscriptionTier
): SubscriptionPermission[] => {
  const tierDef = TIER_DEFINITIONS[tier];
  return tierDef.permissions.filter(
    (p): p is SubscriptionPermission => SUBSCRIPTION_PERMISSIONS.includes(p as SubscriptionPermission)
  );
};

/** Check if user has permission considering both admin role and subscription tier */
export const hasSubscriptionPermission = (
  session: SubscriptionSession,
  required: AdminPermission | SubscriptionPermission
): boolean => {
  // Admin permissions always grant access (unless subscription is not active)
  if (session.subscriptionStatus !== "active") {
    return false;
  }
  return session.permissions.includes(required);
};

/** Check subscription status for feature access */
export const isSubscriptionActive = (
  subscriptionStatus: "active" | "cancelled" | "expired" | "suspended"
): boolean => {
  return subscriptionStatus === "active";
};

/** Build subscription session from token and database claims */
export async function buildSubscriptionSession(
  claims: AccessTokenPayload | null,
  db: any,
  userId?: string
): Promise<SubscriptionSession | null> {
  if (!claims?.email || !userId) return null;

  try {
    // Fetch subscription data
    const subscription = await db
      .prepare(
        "SELECT id, tier, status FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
      )
      .bind(userId)
      .first<{ id: string; tier: SubscriptionTier; status: string }>();

    if (!subscription) {
      // Default to free tier if no active subscription
      return {
        userId,
        email: claims.email,
        tier: "free",
        subscriptionId: "",
        subscriptionStatus: "active",
        permissions: getTierPermissions("free"),
        rolPermissions: [],
        tierPermissions: getTierPermissions("free"),
        verificationMethods: [],
        isVerified: claims.email_verified ?? false,
      };
    }

    // Fetch verification methods
    const verifications = await db
      .prepare(
        "SELECT type FROM verification_methods WHERE user_id = ? AND verified = 1"
      )
      .bind(userId)
      .all<{ type: string }>();

    const verificationMethods = verifications.results?.map((v) => v.type) ?? [];

    const tierPermissions = getTierPermissions(subscription.tier);

    return {
      userId,
      email: claims.email,
      tier: subscription.tier,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status as any,
      permissions: tierPermissions,
      rolPermissions: [],
      tierPermissions,
      verificationMethods,
      isVerified: claims.email_verified ?? false,
    };
  } catch (error) {
    console.error("Error building subscription session:", error);
    return null;
  }
}

/** Calculate remaining quota for the month */
export async function getSubscriptionQuota(
  subscriptionId: string,
  db: any
): Promise<{
  apiCallsRemaining: number;
  storageRemaining: number;
  projectsRemaining: number;
  usersRemaining: number;
}> {
  const subscription = await db
    .prepare("SELECT tier FROM subscriptions WHERE id = ?")
    .bind(subscriptionId)
    .first<{ tier: SubscriptionTier }>();

  if (!subscription) {
    return {
      apiCallsRemaining: 0,
      storageRemaining: 0,
      projectsRemaining: 0,
      usersRemaining: 0,
    };
  }

  const tierDef = TIER_DEFINITIONS[subscription.tier];
  const currentMonth = new Date().toISOString().split("T")[0].slice(0, 7); // YYYY-MM

  const usage = await db
    .prepare(
      "SELECT api_calls_used, storage_used_gb, projects_created, users_invited FROM subscription_usage WHERE subscription_id = ? AND month = ?"
    )
    .bind(subscriptionId, currentMonth)
    .first<{
      api_calls_used: number;
      storage_used_gb: number;
      projects_created: number;
      users_invited: number;
    }>();

  return {
    apiCallsRemaining: Math.max(
      0,
      tierDef.maxApiCalls - (usage?.api_calls_used ?? 0)
    ),
    storageRemaining: Math.max(
      0,
      tierDef.maxStorageGb - (usage?.storage_used_gb ?? 0)
    ),
    projectsRemaining: Math.max(
      0,
      tierDef.maxProjects - (usage?.projects_created ?? 0)
    ),
    usersRemaining: Math.max(
      0,
      tierDef.maxUsers - (usage?.users_invited ?? 0)
    ),
  };
}

/** Record a subscription event for analytics */
export async function recordSubscriptionEvent(
  db: any,
  userId: string,
  subscriptionId: string | null,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        "INSERT INTO subscription_events (id, user_id, subscription_id, event_type, metadata) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(id, userId, subscriptionId, eventType, JSON.stringify(metadata ?? {}))
      .run();
  } catch (error) {
    console.error("Error recording subscription event:", error);
  }
}
