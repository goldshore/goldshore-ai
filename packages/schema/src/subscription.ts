/** Subscription tier system for GOLDSHORELABS */

export const SUBSCRIPTION_TIERS = ["free", "starter", "pro", "enterprise"] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export interface TierFeatures {
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  maxUsers: number;
  maxProjects: number;
  maxApiCalls: number; // per month
  maxStorageGb: number;
  features: string[];
  permissions: string[]; // Tier-specific permissions
}

export const TIER_DEFINITIONS: Record<SubscriptionTier, TierFeatures> = {
  free: {
    name: "Free",
    description: "Perfect for getting started",
    monthlyPrice: 0,
    annualPrice: 0,
    maxUsers: 1,
    maxProjects: 1,
    maxApiCalls: 1000,
    maxStorageGb: 1,
    features: [
      "Basic dashboard",
      "1 project",
      "1 user",
      "Email support",
      "API access (limited)",
    ],
    permissions: [
      "dashboard:read",
      "content:read",
      "api:read:limited",
      "forms:read",
    ],
  },
  starter: {
    name: "Starter",
    description: "For small teams and projects",
    monthlyPrice: 29,
    annualPrice: 290,
    maxUsers: 3,
    maxProjects: 5,
    maxApiCalls: 50000,
    maxStorageGb: 10,
    features: [
      "Advanced dashboard",
      "Up to 5 projects",
      "Up to 3 users",
      "Email & chat support",
      "Full API access",
      "Basic analytics",
      "Email integrations",
    ],
    permissions: [
      "dashboard:read",
      "content:read",
      "content:write",
      "api:read",
      "api:write",
      "forms:read",
      "forms:create",
      "analytics:read:basic",
      "integrations:read",
    ],
  },
  pro: {
    name: "Pro",
    description: "For growing businesses",
    monthlyPrice: 99,
    annualPrice: 990,
    maxUsers: 10,
    maxProjects: 25,
    maxApiCalls: 500000,
    maxStorageGb: 100,
    features: [
      "Priority dashboard",
      "Up to 25 projects",
      "Up to 10 users",
      "Priority support",
      "Full API access",
      "Advanced analytics",
      "Advanced integrations",
      "Custom branding",
      "SSO support",
      "Webhooks",
    ],
    permissions: [
      "dashboard:read",
      "dashboard:write",
      "content:read",
      "content:write",
      "content:publish",
      "api:read",
      "api:write",
      "api:admin",
      "forms:read",
      "forms:create",
      "forms:update",
      "forms:publish",
      "analytics:read:advanced",
      "analytics:write",
      "integrations:read",
      "integrations:create",
      "sso:manage",
      "webhooks:manage",
      "collaborators:invite",
    ],
  },
  enterprise: {
    name: "Enterprise",
    description: "For large organizations",
    monthlyPrice: 0, // Custom pricing
    annualPrice: 0, // Custom pricing
    maxUsers: 999,
    maxProjects: 999,
    maxApiCalls: 999999999,
    maxStorageGb: 1000,
    features: [
      "Dedicated account manager",
      "Unlimited projects",
      "Unlimited users",
      "24/7 phone support",
      "Unlimited API access",
      "Real-time analytics",
      "Custom integrations",
      "White-label solution",
      "Advanced SSO & SAML",
      "Advanced webhooks",
      "Audit logs",
      "Data residency options",
      "SLA guarantee",
    ],
    permissions: [
      "dashboard:read",
      "dashboard:write",
      "dashboard:admin",
      "content:read",
      "content:write",
      "content:publish",
      "api:read",
      "api:write",
      "api:admin",
      "api:management",
      "forms:read",
      "forms:create",
      "forms:update",
      "forms:publish",
      "forms:admin",
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
    ],
  },
};

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: "active" | "cancelled" | "expired" | "suspended";
  startDate: string; // ISO 8601
  endDate: string | null; // ISO 8601 or null for active
  renewalDate: string | null;
  billingCycle: "monthly" | "annual";
  stripeSubscriptionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionUsage {
  subscriptionId: string;
  month: string; // YYYY-MM
  apiCallsUsed: number;
  storageUsedGb: number;
  projectsCreated: number;
  usersInvited: number;
  updatedAt: string;
}

export interface VerificationMethod {
  id: string;
  userId: string;
  type: "email" | "phone" | "google_oauth" | "github_oauth";
  value: string; // email or phone number
  verified: boolean;
  verificationCode?: string;
  verificationCodeExpiry?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionEvent {
  id: string;
  userId: string;
  subscriptionId: string;
  eventType:
    | "tier_upgrade"
    | "tier_downgrade"
    | "subscription_created"
    | "subscription_cancelled"
    | "subscription_renewed"
    | "payment_failed"
    | "feature_accessed"
    | "limit_exceeded";
  metadata?: Record<string, unknown>;
  createdAt: string;
}
