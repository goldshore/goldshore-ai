import type { Env } from '../types';

/**
 * Single resolution point for Cloudflare API credentials.
 *
 * `CF_TOKEN` / `CF_ACCOUNT_ID` / `CF_ZONE_ID` are the canonical binding names
 * (see `apps/gs-api/secret-contract.json`). The `CLOUDFLARE_*` names are the
 * pre-rename aliases and are still read as a fallback so a Worker configured
 * with either scheme keeps working. Every consumer must go through these
 * helpers rather than reading `env` directly, so no endpoint can end up
 * requiring one name from each scheme.
 */
export const cfToken = (env: Env) => env.CF_TOKEN || env.CLOUDFLARE_API_TOKEN;
export const cfAccountId = (env: Env) => env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
export const cfZoneId = (env: Env) => env.CF_ZONE_ID || env.CLOUDFLARE_ZONE_ID;

/**
 * Resolves the credential pair required for account-scoped Cloudflare API
 * calls, throwing with the canonical names of whatever is missing.
 */
export const requireCloudflare = (env: Env) => {
  const token = cfToken(env);
  const accountId = cfAccountId(env);
  if (!token || !accountId) {
    const missing = [!accountId && 'CF_ACCOUNT_ID', !token && 'CF_TOKEN'].filter(Boolean).join(', ');
    throw new Error(`Cloudflare API credentials not configured: ${missing}`);
  }
  return { token, accountId };
};

/** Resolves the zone id, throwing with the canonical name when it is absent. */
export const requireCloudflareZone = (env: Env) => {
  const zoneId = cfZoneId(env);
  if (!zoneId) throw new Error('Cloudflare API credentials not configured: CF_ZONE_ID');
  return zoneId;
};
