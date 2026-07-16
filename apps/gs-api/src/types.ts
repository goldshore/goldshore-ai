import { type AccessTokenPayload } from "@goldshore/auth";

export type Env = {
  KV: KVNamespace;
  CONTROL_LOGS?: KVNamespace;
  PLATFORM_DB: D1Database;
  TELEMETRY_DB?: D1Database;
  GS_ASSETS: R2Bucket;
  AUTH_SESSION?: DurableObjectNamespace;
  AI: Ai;
  INTEGRATION_MASTER_KEY?: SecretsStoreSecret | string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  JWT_SECRET?: string;
  STRIPE_API_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_CONNECT_CLIENT_ID?: string;
  SENDGRID_API_KEY?: string;
  ACCESS_CLIENT_SECRET?: string;
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  CONTROL_SYNC_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
  MAIL_FORWARD_TO?: string;
  FORWARD_TO?: string;
  MAIL_BLOCKED_SENDERS?: string;
  MAIL_ALLOWED_RECIPIENTS?: string;
  AGENT?: Fetcher;
  API_ORIGIN?: string;
  ADMIN_URL?: string;
  ENV?: string;
  DEV_AUTH_BYPASS?: string;
  API_VERSION?: string;
  DEPLOY_SHA?: string;
  GIT_SHA?: string;
  CONTROL_ADMIN_ROLES?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_INSTALLATION_ID?: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GH_WEBHOOK_SECRET?: string;
  GITHUB_STATUS_TOKEN?: string;
  GITHUB_STATUS_CONTEXT?: string;
  GITHUB_STATUS_TARGET_URL?: string;
  GITHUB_STATUS_REPORTING_DISABLED?: string;
  GITHUB_WEBHOOK_ALLOWED_EVENTS?: string;
  GITHUB_WEBHOOK_POST_DEPLOY_URLS?: string;
  GITHUB_WEBHOOK_POST_DEPLOY_TOKEN?: string;
  GOOGLE_ADS_DEVELOPER_TOKEN?: string;
  GOOGLE_ADS_LOGIN_CUSTOMER_ID?: string;
  GOOGLE_ANALYTICS_PROPERTY_ID?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_BUSINESS_ID?: string;
  META_AD_ACCOUNT_ID?: string;
  META_PIXEL_ID?: string;
  INSTAGRAM_BUSINESS_ACCOUNT_ID?: string;
  X_CLIENT_ID?: string;
  X_CLIENT_SECRET?: string;
  X_AD_ACCOUNT_ID?: string;
  GOLDCLAW_SANDBOX_API_URL?: string;
  GOLDCLAW_SANDBOX_API_TOKEN?: string;
  GOLDCLAW_SANDBOX_PROVIDER?: string;
  OPENCLAW_BASE_URL?: string;
  OPENCLAW_API_KEY?: string;
  OPENCLAW_MODEL?: string;
  OAUTH_TOKEN_ENCRYPTION_KEY?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;
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

export type KeyType = 'apiKey' | 'apiSecret' | 'webhook_secret' | 'oauth_token';

export type IntegrationSecret = {
  id: string;
  integration_id: string;
  key_type: KeyType;
  key_prefix: string;
  key_hash: string;
  created_at: string;
  rotated_at?: string;
  expires_at?: string;
  created_by: string;
  rotation_count: number;
  metadata?: Record<string, unknown>;
};

export type IntegrationSecretRequest = {
  integration_id: string;
  key_type: KeyType;
  value: string;
  metadata?: Record<string, unknown>;
  expires_at?: string;
};

export type IntegrationSecretResponse = Omit<IntegrationSecret, 'encrypted_value'> & {
  key_prefix: string;
};
