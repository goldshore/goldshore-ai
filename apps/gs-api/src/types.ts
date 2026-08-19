import type { AccessTokenPayload } from '@goldshore/auth';
import type { SessionUser } from './lib/sessions';

type ResourceBindings = {
  KV: KVNamespace;
  CONTROL_LOGS?: KVNamespace;
  TRADING_KV?: KVNamespace;
  PLATFORM_DB: D1Database;
  AUDIT_DB?: D1Database;
  SIGNALS_DB?: D1Database;
  JOBS_DB?: D1Database;
  PAPER_DB?: D1Database;
  RISK_RADAR_DB?: D1Database;
  TELEMETRY_DB?: D1Database;
  GS_ASSETS: R2Bucket;
  HOSTGATOR_DB?: Hyperdrive;
  MAIL_ARCHIVE?: R2Bucket;
  RISK_RADAR_R2?: R2Bucket;
  TELEMETRY?: R2Bucket;
  AUTH_SESSION?: DurableObjectNamespace;
  EMAIL?: SendEmail;
  AI: Ai;
  JOBS_QUEUE?: Queue;
  EVENTS_QUEUE?: Queue;
  MAIL_JOBS_QUEUE?: Queue;
  GS_SIGNALS?: Workflow<SignalsEvaluatorParams>;
  AGENT?: Fetcher;
};

type RuntimeSecrets = {
  ACCESS_CLIENT_SECRET?: string;
  ADMIN_WHATSAPP_NUMBER?: string;
  ALLOWED_ORIGINS?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_GATEWAY_ID?: string;
  ANTHROPIC_GATEWAY_VERIFIED?: string;
  API_VERSION?: string;
  DEPLOY_SHA?: string;
  GIT_SHA?: string;
  CONTROL_ADMIN_ROLES?: string;
  MAIL_FORWARD_TO?: string;
  FORWARD_TO?: string;
  API_ORIGIN?: string;
  CF_TOKEN?: string;
  CF_AIG_TOKEN?: string;
  CF_WEBHOOK_TOKEN?: string;
  CF_VERSION_METADATA?: { id: string };
  CF_ACCOUNT_ID?: string;
  CF_ZONE_ID?: string;
  CLOUDFLARE_BUILD_API_TOKEN?: string;
  GITHUB_API_TOKEN?: string;
  GH_TOKEN?: string;
  CLOUDFLARE_ZONE_NAME?: string;
  CLOUDFLARE_PAGES_PROJECT?: string;
  ADMIN_URL?: string;
  ENV?: string;
  DEV_AUTH_BYPASS?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;
  GOOGLE_BUSINESS_OAUTH_REDIRECT_URI?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_TOKEN?: string;
  GOOGLE_ADMIN_SERVICE_ACCOUNT?: string;
  GOOGLE_ADS_DEVELOPER_TOKEN?: string;
  GOOGLE_ADS_LOGIN_CUSTOMER_ID?: string;
  GOOGLE_ADS_REFRESH_TOKEN?: string;
  GOOGLE_ANALYTICS_PROPERTY_ID?: string;
  GOOGLE_BUSINESS_ACCOUNT_IDS?: string;
  GOOGLE_BUSINESS_LOCATION_IDS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_GSC_CLIENT_ID?: string;
  GOOGLE_GSC_CLIENT_SECRET?: string;
  GOOGLE_GSC_REFRESH_TOKEN?: string;
  GOOGLE_GSC_SITE_URL?: string;
  GOOGLE_WEBHOOK_TOKEN?: string;
  GOLDCLAW_SANDBOX_API_TOKEN?: string;
  GOLDCLAW_SANDBOX_API_URL?: string;
  GOLDCLAW_SANDBOX_PROVIDER?: string;
  GS_GITHUB_WEBHOOK_SECRET?: string;
  INTEGRATION_MASTER_KEY?: string;
  INSTAGRAM_BUSINESS_ACCOUNT_ID?: string;
  JWT_SECRET?: string;
  LLM_API_KEY?: string;
  LLM_BASE_URL?: string;
  LLM_MAX_TOKENS?: string;
  LLM_MODEL?: string;
  LLM_PROVIDER?: string;
  LLM_TEMPERATURE?: string;
  LOCAL_LLM_API_KEY?: string;
  LOCAL_LLM_BASE_URL?: string;
  MAIL_ALLOWED_RECIPIENTS?: string;
  MAIL_BLOCKED_SENDERS?: string;
  META_AD_ACCOUNT_ID?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_BUSINESS_ID?: string;
  META_PIXEL_ID?: string;
  NOTIFY_EMAIL_WEBHOOK?: string;
  NOTIFY_SMS_WEBHOOK?: string;
  NOTIFY_WEBHOOK_URL?: string;
  OAUTH_TOKEN_ENCRYPTION_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENCLAW_API_KEY?: string;
  // ────────────────────────────────────────────────────────────────────────────
  // DEPRECATED SECRETS — Do not use in new code. Use primary names only.
  // ────────────────────────────────────────────────────────────────────────────
  CLOUDFLARE_API_TOKEN?: string; // Use CF_TOKEN instead
  CLOUDFLARE_ACCOUNT_ID?: string; // Use CF_ACCOUNT_ID instead
  CLOUDFLARE_ZONE_ID?: string; // Use CF_ZONE_ID or CLOUDFLARE_GOLDSHORE_AI_ZONE_ID instead
  CF_AUTH_KEY?: string; // Deprecated: legacy global API key auth
  CF_ACCOUNT_KEY?: string; // Deprecated: legacy account-level API key auth
  GOLDSHORE_CF_TOKEN?: string; // Use CF_TOKEN instead
  OPENAI_API_TOKEN?: string; // Use OPENAI_API_KEY instead
  CLOUDFLARE_BUILD_TOKEN?: string; // Use CLOUDFLARE_BUILD_API_TOKEN instead
  CF_WORKERS_BUILDS?: string; // Use CLOUDFLARE_BUILD_API_TOKEN instead
  GOLDSHORE_CF_TOKEN_SECRET_ACCESS_KEY?: string; // Unclear purpose — audit for removal
  GS_DISPATCH_TOKEN?: string; // Stale: last rotated 2+ months ago
  CLOUDFLARE_CA_ORIGIN_KEY?: string; // Stale: last verified 2+ months ago
  OPENCLAW_BASE_URL?: string;
  PORT?: string;
  ROBINHOOD_ACCOUNT_ID?: string;
  ROBINHOOD_TOKEN?: string;
  SCHWAB_ACCOUNT_HASH?: string;
  SCHWAB_CLIENT_ID?: string;
  SCHWAB_CLIENT_SECRET?: string;
  SCHWAB_REDIRECT_URI?: string;
  SCHWAB_REFRESH_TOKEN?: string;
  SENDGRID_API_KEY?: string;
  STATE_MUTATIONS_ENABLED?: string;
  STELLAR_AIO_WEBHOOK_URL?: string;
  STRIPE_API_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  WORKER_SECRET?: string;
  X_AD_ACCOUNT_ID?: string;
  X_CLIENT_ID?: string;
  X_CLIENT_SECRET?: string;
  GS_SIGNALS_DB?: D1Database;
};

type RuntimeVariables = {
  AI_SEARCH_PUBLIC_ENDPOINT?: string;
  ADMIN_PROXY_AUDIENCE?: string;
  ADMIN_URL?: string;
  API_ORIGIN?: string;
  CLOUDFLARE_ACCESS_APPLICATION?: string;
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_SERVICE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  CONTACT_NOTIFICATION_EMAILS?: string;
  ENV?: string;
  GOOGLE_BUSINESS_OAUTH_REDIRECT_URI?: string;
  GOOGLE_BUSINESS_OWNERSHIP_VERIFIED?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_PRODUCTION_APPROVED?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;
  GOOGLE_WORKSPACE_ACCESS_APPLICATIONS?: string;
  GOOGLE_WORKSPACE_CUSTOMER_ID?: string;
  GOOGLE_WORKSPACE_DELEGATED_ADMIN?: string;
  GOOGLE_WORKSPACE_GROUP_ROLE_MAP?: string;
  GOOGLE_WORKSPACE_SYNC_ENABLED?: string;
  GITHUB_OAUTH_REDIRECT_URI?: string;
  MAIL_FORWARD_TO?: string;
  MAIL_FROM_EMAIL?: string;
  MAIL_FROM_NAME?: string;
  PUBLIC_SITE_URL?: string;
};

/** Runtime code uses broad variable types while worker-configuration.d.ts is
 * the machine-checked declaration of the exact production binding manifest. */
export type Env = ResourceBindings & RuntimeSecrets & RuntimeVariables;

export type SignalsEvaluatorParams = {
  signalId: string;
  source?: string;
  payload?: Record<string, unknown>;
};

export type Variables = {
  accessClaims: AccessTokenPayload | null;
  requestId: string;
  user?: SessionUser;
};

export type AuditEvent = {
  action: string;
  actor?: string;
  status: 'success' | 'denied' | 'error';
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
