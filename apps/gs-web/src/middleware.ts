import type { MiddlewareHandler } from 'astro';
import { ADMIN_PERMISSIONS, verifyJWTCookie } from '@goldshore/auth';
import { HTML_CONTENT_SECURITY_POLICY } from './security/policy';
import {
  authorizeAdminRequest,
  ADMIN_DASHBOARD_PATH,
  getAdminRouteRule,
  getAdminHostRewritePath,
  isAdminHost,
} from './utils/admin-access';

const getRequestHostname = (request: Request, url: URL) =>
  (request.headers.get('host') ?? url.hostname).split(':')[0].toLowerCase();

export const onRequest: MiddlewareHandler = async (context, next) => {
  // Redirect risk.goldshore.ai root → /risk-radar (subdomain alias for the product page).
  const host = getRequestHostname(context.request, context.url);
  if (
    (host === 'risk.goldshore.ai' || host === 'risk.goldshore.org') &&
    context.url.pathname === '/'
  ) {
    return context.redirect('/risk-radar', 301);
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
  const routedPath = adminRewritePath ?? url.pathname;
  const adminRule = getAdminRouteRule(
    routedPath,
    context.request.method,
    host,
  );

  if (adminRule) {
    const runtimeEnv = context.locals.runtime?.env as Env | undefined;
    const allowLocalAdminBypass = import.meta.env.DEV || runtimeEnv?.DEV_AUTH_BYPASS === '1';

    if (allowLocalAdminBypass) {
      context.locals.adminSession = {
        roles: ['admin'],
        permissions: [...ADMIN_PERMISSIONS],
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
      isAdminHost(host) &&
      routedPath === ADMIN_DASHBOARD_PATH &&
      url.pathname !== ADMIN_DASHBOARD_PATH
    ) {
      return Response.redirect(new URL(ADMIN_DASHBOARD_PATH, url.origin), 302);
    }
  }

  const response = adminRewritePath
    ? await context.rewrite(adminRewritePath)
    : await next();
  response.headers.set('Content-Security-Policy', HTML_CONTENT_SECURITY_POLICY);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
};
