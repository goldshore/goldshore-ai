// Type definitions for environment variables
interface ImportMetaEnv {
  readonly PUBLIC_API: string;
  readonly PUBLIC_AUTH_TOKEN_URL: string;
  readonly PUBLIC_AUTH_CLIENT_ID: string;
  readonly PUBLIC_BUILD_TIMESTAMP: string;
  readonly PUBLIC_COMMIT_HASH: string;
  readonly PUBLIC_RELEASE_LABEL?: string;
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly AUTH_CLIENT_SECRET: string;
  // Add other env vars as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global Cloudflare Env types
interface Env {
  PUBLIC_API?: string;
  CONTACT_TTL_SECONDS?: string;
  CONTACT_NOTIFICATION_EMAILS?: string;
  MAILCHANNELS_SENDER_EMAIL?: string;
  MAILCHANNELS_SENDER_NAME?: string;
  MAILCHANNELS_API_URL?: string;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
    };
    securityPolicySource?: 'response-header' | 'platform-config';
  }
}
