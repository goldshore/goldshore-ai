/// <reference types="astro/client" />
import type { AdminSession } from "@goldshore/auth";

declare namespace App {
  interface Locals {
    adminSession: AdminSession & {
      actor?: string;
      isAuthenticated: boolean;
    };
  }
}

// Type definitions for environment variables
interface ImportMetaEnv {
  readonly PUBLIC_API: string;
  readonly PUBLIC_GATEWAY: string;

  // Auth Configuration
  readonly PUBLIC_AUTH_TOKEN_URL: string;
  readonly PUBLIC_AUTH_CLIENT_ID: string;

  /**
   * @deprecated SECURITY RISK: Do not use PUBLIC_ prefix for secrets. Use AUTH_CLIENT_SECRET instead.
   */
  readonly PUBLIC_AUTH_CLIENT_SECRET?: string;

  /**
   * Secure Client Secret (Server-side only)
   */
  readonly AUTH_CLIENT_SECRET?: string;

  /**
   * Server-side only gs-api base URL (overrides PUBLIC_API when set).
   */
  readonly GS_API_URL?: string;

  /**
   * Comma-separated roles allowed to access gs-api proxy/config endpoints.
   */
  readonly ADMIN_GS_API_ROLES?: string;

  /**
   * Cloudflare Access verification settings.
   */
  readonly CLOUDFLARE_ACCESS_AUDIENCE?: string;
  readonly CLOUDFLARE_TEAM_DOMAIN?: string;

  readonly PUBLIC_ADMIN_AUDIT_ENDPOINT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
