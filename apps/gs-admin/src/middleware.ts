import { onRequest as baseMiddleware } from "@goldshore/config/middleware";
import { defineMiddleware, sequence } from "astro:middleware";
import {
  ADMIN_ROLES,
  buildAdminSession,
  getAdminPermissions,
  verifyAccessWithClaims
} from "@goldshore/auth";

type AdminEnv = {
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  ADMIN_DEV_ROLE?: string;
};

const API_BASE = import.meta.env.PUBLIC_API;

const authMiddleware = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const isAssetRoute =
    pathname.startsWith('/_astro') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/fonts');

  if (!isAssetRoute) {
    const sessionCookie = context.cookies.get('gs_admin_session');
    const accessHeader = context.request.headers.get('CF-Access-Jwt-Assertion');

    if (!sessionCookie && API_BASE && accessHeader) {
      const response = await fetch(`${API_BASE}/admin/session`, {
        method: 'POST',
        headers: {
          'CF-Access-Jwt-Assertion': accessHeader
        },
        credentials: 'include'
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload.sessionId) {
          const isSecure = context.url.protocol === 'https:';
          context.cookies.set('gs_admin_session', payload.sessionId, {
            path: '/',
            httpOnly: true,
            secure: isSecure,
            sameSite: isSecure ? 'none' : 'lax',
            maxAge: payload.ttlSeconds ?? 60 * 60 * 8
          });
        }
      }
    }

    // Basic session check logic could go here if needed, but we rely on verifyAccessWithClaims below
  }

  const env = (context.locals.runtime?.env ?? {}) as AdminEnv;
  const claims = await verifyAccessWithClaims(context.request, env);
  let session = buildAdminSession(claims);

  if (!claims && import.meta.env.DEV && env.ADMIN_DEV_ROLE) {
    const role = env.ADMIN_DEV_ROLE.toLowerCase();
    if (ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
      session = {
        roles: [role as (typeof ADMIN_ROLES)[number]],
        permissions: getAdminPermissions([role as (typeof ADMIN_ROLES)[number]])
      };
    }
  }
  const actor =
    claims?.email ||
    context.request.headers.get("CF-Access-Authenticated-User-Email") ||
    context.request.headers.get("CF-Access-Authenticated-User-Id") ||
    undefined;

  context.locals.adminSession = {
    ...session,
    actor,
    isAuthenticated: Boolean(claims)
  };

  return next();
});

const securityMiddleware = defineMiddleware(async (context, next) => {
  const response = await next();

  // Sentinel: Add security headers to protect against common attacks
  // X-Frame-Options: Protects against Clickjacking - DENY for admin panel
  response.headers.set("X-Frame-Options", "DENY");

  // X-Content-Type-Options: Protects against MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer-Policy: Controls how much referrer information is sent
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Strict-Transport-Security: Enforce HTTPS (HSTS)
  // max-age=31536000 (1 year), includeSubDomains, preload
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  // Permissions-Policy: Restrict access to sensitive features not needed in admin dashboard
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");

  return response;
});

export const onRequest = sequence(baseMiddleware, authMiddleware, securityMiddleware);
