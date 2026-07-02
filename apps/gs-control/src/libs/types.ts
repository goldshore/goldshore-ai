export type ControlEnv = {
  ALLOWED_ORIGINS?: string;
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  CONTROL_ADMIN_ROLES?: string;
  DNS_SYNC_TARGETS?: string;
  CONTROL_LOGS: KVNamespace;
  GS_CONFIG?: KVNamespace;
  STATE: R2Bucket;
  API: Fetcher;
  GATEWAY: Fetcher;
};
