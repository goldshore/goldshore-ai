/**
 * JWKS Caching Middleware
 *
 * Caches remote JWKS (JSON Web Key Set) from Cloudflare Access to avoid
 * refetching on every JWT verification. Invalidates cache when JWKS URL changes.
 */

import { createRemoteJWKSet } from 'jose';
import type { Env } from '../types';

let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let lastJWKSUrl: string | null = null;

export async function getOrCreateJWKS(env: Env): Promise<ReturnType<typeof createRemoteJWKSet>> {
  const jwksUrl = env.CLOUDFLARE_ACCESS_JWKS_URL || env.CF_ACCESS_JWKS_URL;

  if (!jwksUrl) {
    throw new Error('JWKS URL not configured');
  }

  if (cachedJWKS && lastJWKSUrl === jwksUrl) {
    return cachedJWKS;
  }

  cachedJWKS = createRemoteJWKSet(new URL(jwksUrl));
  lastJWKSUrl = jwksUrl;
  return cachedJWKS;
}

export function invalidateJWKSCache(): void {
  cachedJWKS = null;
  lastJWKSUrl = null;
}
