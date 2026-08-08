import type { MiddlewareHandler } from 'astro';
import { verifyJWTCookie } from '@goldshore/auth';
import { HTML_CONTENT_SECURITY_POLICY } from './security/policy';
import {
  authorizeAdminRequest,
  getAdminRouteRule,
  getAdminHostRewritePath,
  isAdminHost,
  isStaticAssetPath,
} from './utils/admin-access';

const ADMIN_PATH_PREFIXES = ['/admin', '/api/admin'];

const isAdminPath = (pathname: string) =>
  ADMIN_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const getRequestHostname = (request: Request, url: URL) =>
  (request.headers.get('host') ?? url.hostname).split(':')[0].toLowerCase();

const isProtectedAdminRequest = (request: Request, url: URL) =>
  isAdminPath(url.pathname) ||
  (isAdminHost(getRequestHostname(request, url)) && !isStaticAssetPath(url.pathname));

export const onRequest: MiddlewareHandler = async (context, next) => {
  // Redirect risk.goldshore.ai root → /risk-radar (subdomain alias for the product page).
  const host = getRequestHostname(context.request, context.url);
  if (
    (host === 'risk.goldshore.ai' || host === 'risk.goldshore.org') &&
    context.url.pathname === '/'
  ) {
    return context.redirect('/risk-radar', 301);
  }

  // JWT cookie-based authentication gate for the admin surface.
  // Verifies JWT from 'auth' cookie to allow admin access.
  if (isProtectedAdminRequest(context.request, context.url)) {
    const runtimeEnv = context.locals.runtime?.env as Env | undefined;
    const allowLocalAdminBypass = import.meta.env.DEV || runtimeEnv?.DEV_AUTH_BYPASS === '1';

    if (!allowLocalAdminBypass) {
      const claims = await verifyJWTCookie(context.request, runtimeEnv ?? {});
      if (!claims) {
        return new Response('Unauthorized', {
          status: 401,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
    }
  }

  // The admin hostname is a first-class alias for gs-web's existing admin
  // route tree. Keep implementation paths canonical without exposing the
  // /admin prefix in operator-facing URLs.
  const adminRewritePath = isAdminHost(host)
    ? getAdminHostRewritePath(context.url.pathname)
    : null;

  // Response headers are authoritative for Astro-rendered HTML. Static files
  // that can bypass middleware keep their own platform config in public/_headers.
  context.locals.securityPolicySource = 'response-header';

  const url = new URL(context.request.url);
  const adminRule = getAdminRouteRule(
    url.pathname,
    context.request.method,
    url.hostname,
  );

  if (adminRule) {
    const runtimeEnv = context.locals.runtime?.env as Env | undefined;
    const allowLocalAdminBypass = import.meta.env.DEV || runtimeEnv?.DEV_AUTH_BYPASS === '1';

    if (allowLocalAdminBypass) {
      context.locals.adminSession = {
        roles: ['admin'],
        permissions: [
          'content:read', 'content:write',
          'system:read', 'system:write',
          'media:read', 'media:write',
          'forms:read', 'forms:write',
          'users:manage',
          'audit:read',
          'ai:analyze',
          'system:integrations:manage'
        ],
        isAuthenticated: true
      };
    } else {
      const authResult = await authorizeAdminRequest(
        context.request,
        runtimeEnv ?? {},
        adminRule,
      );

      if (authResult.ok === false) {
        const isApiRoute = adminRule.kind === 'api';
        const body = isApiRoute
          ? JSON.stringify({ ok: false, error: authResult.error })
          : authResult.error;

        return new Response(body, {
          status: authResult.status,
          headers: {
            'content-type': isApiRoute
              ? 'application/json; charset=utf-8'
              : 'text/plain; charset=utf-8',
          },
        });
      }

      context.locals.adminSession = {
        ...authResult.session,
        isAuthenticated: true
      };
    }

    if (
      adminRule.kind === 'page' &&
      isAdminHost(url.hostname) &&
      url.pathname !== adminRule.canonicalPath
    ) {
      return Response.redirect(new URL(adminRule.canonicalPath, url.origin), 302);
    }
  }

  const response = await next();
  response.headers.set('Content-Security-Policy', HTML_CONTENT_SECURITY_POLICY);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
};
