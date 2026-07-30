import type { MiddlewareHandler } from 'astro';
import { verifyAccessWithClaims } from '@goldshore/auth';
import { HTML_CONTENT_SECURITY_POLICY } from './security/policy';
import {
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

  // Cloudflare Access (Zero Trust) gate for the admin surface. The canonical
  // gate is a Self-hosted Access Application on goldshore.ai/admin/* in
  // Zero Trust → Access → Applications (see
  // goldclaw/docs/cf-infrastructure.md) — that must still be created in the
  // dashboard, nothing here can provision it. Until it exists, this check is
  // the only thing standing between the public internet and these pages,
  // since the apps/gs-web/src/pages/admin/*.astro page shells otherwise have
  // no server-side auth of their own.
  if (isProtectedAdminRequest(context.request, context.url)) {
    const runtimeEnv = context.locals.runtime?.env as Env | undefined;
    const allowLocalAdminBypass = import.meta.env.DEV || runtimeEnv?.DEV_AUTH_BYPASS === '1';

    if (!allowLocalAdminBypass) {
      const claims = await verifyAccessWithClaims(context.request, runtimeEnv ?? {});
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
