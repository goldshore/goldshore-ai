import { createRemoteJWKSet, jwtVerify, type JWTPayload, SignJWT, importSPKI } from "jose";

export interface Env {
    // Sentinel: Added support for Audience verification to prevent auth bypass
    CLOUDFLARE_ACCESS_AUDIENCE?: string;
    // Sentinel: Added support for dynamic team domain
    CLOUDFLARE_TEAM_DOMAIN?: string;
    // JWT secret for cookie-based authentication
    JWT_SECRET?: string;
}

// Sentinel: Default to existing hardcoded values if not provided in Env
const DEFAULT_TEAM_DOMAIN = "goldshore.cloudflareaccess.com";

function normalizeTeamDomain(teamDomain?: string): string {
    if (!teamDomain) {
        return DEFAULT_TEAM_DOMAIN;
    }

    return teamDomain.includes(".") ? teamDomain : `${teamDomain}.cloudflareaccess.com`;
}

export interface Dependencies {
    createRemoteJWKSet: typeof createRemoteJWKSet;
    jwtVerify: typeof jwtVerify;
}

// Dependencies object to allow mocking in tests
export const deps: Dependencies = {
    createRemoteJWKSet,
    jwtVerify
};

// Cache JWKS sets by domain to avoid recreation on every request while supporting multiple domains if needed
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(domain: string, deps: Dependencies) {
    if (!jwksCache.has(domain)) {
        jwksCache.set(domain, deps.createRemoteJWKSet(new URL(`https://${domain}/cdn-cgi/access/certs`)));
    }
    return jwksCache.get(domain)!;
}

export type AccessTokenPayload = JWTPayload & {
  email?: string;
  groups?: string[] | string;
  roles?: string[] | string;
  role?: string;
};

// Internal function with dependencies exposed for testing
export async function verifyAccessWithClaimsInternal(req: Request, env: Env, deps: Dependencies) {
  const token = req.headers.get("CF-Access-Jwt-Assertion");
  if (!token) return null;

  const teamDomain = normalizeTeamDomain(env?.CLOUDFLARE_TEAM_DOMAIN);
  const JWKS = getJwks(teamDomain, deps);

  try {
    const options: { issuer: string; audience?: string } = {
      issuer: `https://${teamDomain}`,
    };

    // Sentinel: Verify audience if provided.
    // This is a CRITICAL security enhancement to prevent a token from one app being used in another.
    if (env && env.CLOUDFLARE_ACCESS_AUDIENCE) {
        options.audience = env.CLOUDFLARE_ACCESS_AUDIENCE;
    }

    const { payload } = await deps.jwtVerify(token, JWKS, options);
    return payload as AccessTokenPayload;
  } catch (e) {
    console.error("Token verification failed", e);
    return null;
  }
}

export async function verifyAccessWithClaims(req: Request, env: Env) {
    return verifyAccessWithClaimsInternal(req, env, deps);
}

export async function verifyAccess(req: Request, env: Env) {
  const claims = await verifyAccessWithClaims(req, env);
  return claims !== null;
}

export async function verifyJWTCookie(req: Request, env: Env, cookieName = 'auth'): Promise<AccessTokenPayload | null> {
  if (!env?.JWT_SECRET) return null;

  const cookies = req.headers.get('cookie');
  if (!cookies) return null;

  const cookieMatch = cookies.split(';').find(c => c.trim().startsWith(`${cookieName}=`));
  if (!cookieMatch) return null;

  const token = cookieMatch.split('=')[1];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET));
    return payload as AccessTokenPayload;
  } catch (e) {
    console.error("JWT cookie verification failed", e);
    return null;
  }
}
