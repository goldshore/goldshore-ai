import type { Context, Next } from "hono";
import { verifyAccessWithClaims, type Env } from "@goldshore/auth";

/**
 * Auth Middleware for gs-gateway
 * Purpose: Enforce JWT token validation and fail CLOSED on auth failure
 *
 * SECURITY: This middleware MUST check the return value from verifyAccessWithClaims
 * and BLOCK requests that fail authentication.
 *
 * Public routes (health, /):
 *   - These routes BYPASS auth (fail open by design — no sensitive data)
 * Protected routes (everything else):
 *   - Token MUST be present and valid
 *   - Invalid tokens → 401 Unauthorized (fail closed)
 *   - Token without audience claim → 401 if CLOUDFLARE_ACCESS_AUDIENCE is set
 * Stripe routes (/stripe/*):
 *   - STRIPE_SECRET_KEY must be set; requests are rejected (503) if missing (fail closed)
 */

export interface AuthMiddlewareEnv extends Env {
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  STRIPE_SECRET_KEY?: string;
  ENV?: string;
}

const PUBLIC_PATHS = ["/", "/health", "/status"];

/** Paths that are public and bypass JWT auth (fail open). */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || !!pathname.match(/^\/health\//);
}

/** Paths that handle Stripe operations and require STRIPE_SECRET_KEY (fail closed). */
function isStripePath(pathname: string): boolean {
  return pathname.startsWith("/stripe/") || pathname.startsWith("/webhooks/stripe");
}

/**
 * Auth middleware — Hono-style (c, next).
 *
 * - Public paths: proceed without auth (fail open).
 * - Stripe paths: reject with 503 when STRIPE_SECRET_KEY is absent (fail closed).
 * - All other paths: require a valid CF-Access JWT (fail closed on missing/invalid token).
 */
export async function authMiddleware(
  c: Context<{ Bindings: AuthMiddlewareEnv }>,
  next: Next,
): Promise<Response | void> {
  const pathname = new URL(c.req.url).pathname;

  // Public routes bypass authentication (fail open).
  if (isPublicPath(pathname)) {
    return next();
  }

  // Stripe routes require the secret to be present (fail closed).
  if (isStripePath(pathname)) {
    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json(
        {
          error: "Service Unavailable",
          message: "Payment processing is not configured",
          code: "STRIPE_UNAVAILABLE",
        },
        503,
      );
    }
  }

  // All other protected routes: verify CF-Access JWT (fail closed).
  const claims = await verifyAccessWithClaims(c.req.raw, c.env);

  if (!claims) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Valid CF-Access-Jwt-Assertion header required",
        code: "AUTH_FAILED",
      },
      401,
    );
  }

  return next();
}

/**
 * Fail-closed guard: Ensures CLOUDFLARE_ACCESS_AUDIENCE is set in production.
 *
 * In production, audience validation is REQUIRED to prevent token reuse across apps.
 */
export function validateAudienceSecretExists(env: AuthMiddlewareEnv): boolean {
  if (env.ENV !== "production") {
    return true;
  }

  if (!env.CLOUDFLARE_ACCESS_AUDIENCE) {
    console.error(
      "CRITICAL: CLOUDFLARE_ACCESS_AUDIENCE not set in production. Refusing to start.",
    );
    return false;
  }

  return true;
}
