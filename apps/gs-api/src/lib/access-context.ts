import type { AccessTokenPayload, Env as AccessEnv } from '@goldshore/auth';

type ApiAccessEnv = AccessEnv & {
  CLOUDFLARE_SERVICE_ACCESS_AUDIENCE?: string;
};

export const isInternalPath = (path: string) =>
  path === '/internal' || path.startsWith('/internal/');

const includesAudience = (
  claims: AccessTokenPayload,
  audience: string | undefined,
) => {
  if (!audience) return false;
  const claimAudiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  return claimAudiences.includes(audience);
};

/**
 * Internal routes accept either a registered service identity or the Access
 * token forwarded by the authenticated admin UI. Signature, issuer and
 * audience verification still happen before application-scoped RBAC.
 */
export const getInternalVerificationEnv = (
  env: ApiAccessEnv,
  adminAudience: string,
): ApiAccessEnv => ({
  ...env,
  CLOUDFLARE_ACCESS_AUDIENCE: [
    env.CLOUDFLARE_SERVICE_ACCESS_AUDIENCE,
    adminAudience,
  ].filter((audience): audience is string => Boolean(audience)),
});

/** Choose the matching durable role map after the token audience is known. */
export const getInternalAuthorizationEnv = (
  env: ApiAccessEnv,
  claims: AccessTokenPayload,
): ApiAccessEnv =>
  includesAudience(claims, env.CLOUDFLARE_SERVICE_ACCESS_AUDIENCE)
    ? {
        ...env,
        CLOUDFLARE_ACCESS_AUDIENCE: env.CLOUDFLARE_SERVICE_ACCESS_AUDIENCE,
        CLOUDFLARE_ACCESS_APPLICATION: 'service-production',
      }
    : env;
