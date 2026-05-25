import type { MiddlewareHandler } from 'astro';

import {
  authorizeAdminRequest,
  getAdminRouteRule,
  getCanonicalAdminUrl,
  isAdminHost,
} from './utils/admin-access';
import { WEB_HEADERS_CSP } from './utils/csp';

const PUBLIC_WEB_HOSTS = new Set([
  'goldshore.ai',
  'www.goldshore.ai',
  'goldshore.org',
  'www.goldshore.org',
]);

export const onRequest: MiddlewareHandler = async (context, next) => {
  const url = new URL(context.request.url);
  const adminRule = getAdminRouteRule(url.pathname, context.request.method, url.hostname);

  if (adminRule) {
    const isProtectedAdminHost = isAdminHost(url.hostname);

    if (!isProtectedAdminHost && PUBLIC_WEB_HOSTS.has(url.hostname)) {
      if (adminRule.kind === 'page') {
        return context.redirect(getCanonicalAdminUrl(adminRule.canonicalPath), 302);
      }

      return new Response('Forbidden', { status: 403 });
    }

    const env = context.locals.runtime?.env;
    const auth = await authorizeAdminRequest(context.request, env, adminRule);

    if (!auth.ok) {
      return new Response(auth.error, { status: auth.status });
    }
  }

  const response = await next();

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', WEB_HEADERS_CSP);
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload',
  );

  return response;
};
