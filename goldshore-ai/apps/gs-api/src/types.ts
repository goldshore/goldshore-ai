import { type AccessTokenPayload } from "@goldshore/auth";

export type Env = {
  KV: KVNamespace;
  DB: D1Database;
  ASSETS: R2Bucket;
  AI: any;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
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
