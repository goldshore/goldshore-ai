import type { MiddlewareHandler } from 'astro';
import { HTML_CONTENT_SECURITY_POLICY } from './security/policy';
import {
  authorizeAdminRequest,
  getAdminRouteRule,
  isAdminHost,
} from './utils/admin-access';

export const onRequest: MiddlewareHandler = async (context, next) => {
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
    const authResult = await authorizeAdminRequest(
      context.request,
      context.locals.runtime?.env as Parameters<typeof authorizeAdminRequest>[1],
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
