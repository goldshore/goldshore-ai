export interface ControlEnv {
  CONTROL_LOGS: KVNamespace;
  STATE: R2Bucket;
  API: Fetcher;
  GATEWAY: Fetcher;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  CONTROL_ADMIN_ROLES?: string;
  ALLOWED_ORIGINS?: string;
}
