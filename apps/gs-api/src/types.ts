import { type AccessTokenPayload } from "@goldshore/auth";

export type Env = {
  KV: KVNamespace;
  CONTROL_LOGS?: KVNamespace;
  PLATFORM_DB: D1Database;
  TELEMETRY_DB?: D1Database;
  GS_ASSETS: R2Bucket;
  AUTH_SESSION?: DurableObjectNamespace;
  AI: Ai;
  SECRETS: SecretsStore;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  JWT_SECRET?: string;
  STRIPE_API_KEY?: string;
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