import type { MiddlewareHandler } from 'astro';

import { WEB_HEADERS_CSP } from './utils/csp';

export const onRequest: MiddlewareHandler = async (_context, next) => {
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
