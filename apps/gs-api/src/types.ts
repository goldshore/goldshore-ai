import { type AccessTokenPayload } from "@goldshore/auth";

export type Env = {
  KV: KVNamespace;
  CONTROL_LOGS?: KVNamespace;
  PLATFORM_DB: D1Database;
  GS_ASSETS: R2Bucket;
  AI: Ai;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  API_VERSION?: string;
  DEPLOY_SHA?: string;
  GIT_SHA?: string;
  CONTROL_ADMIN_ROLES?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_ZONE_NAME?: string;
  CLOUDFLARE_PAGES_PROJECT?: string;
  MAIL_FORWARD_TO?: string;
  FORWARD_TO?: string;
  MAIL_BLOCKED_SENDERS?: string;
  MAIL_ALLOWED_RECIPIENTS?: string;
  AGENT?: Fetcher;
  API_ORIGIN?: string;
  DEV_AUTH_BYPASS?: string;
};

export type Variables = {
  accessClaims: AccessTokenPayload | null;
};

export type AuditEvent = {
  action: string;
  actor?: string;
  status: "success" | "denied" | "error";
  metadata?: Record<string, unknown>;
  timestamp: string;
};