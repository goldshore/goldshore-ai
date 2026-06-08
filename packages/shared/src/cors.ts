import { cors } from 'hono/cors';
import { APPROVED_API_ORIGINS } from './domain-registry';

export const API_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Goldshore-Client',
  'X-Goldshore-Request-Id',
  'CF-Access-Jwt-Assertion',
];

export const API_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

export function isAllowedApiOrigin(origin: string): boolean {
  return APPROVED_API_ORIGINS.includes(origin as (typeof APPROVED_API_ORIGINS)[number]);
}

export function createCorsMiddleware(opts?: { allowLocalhost?: boolean }) {
  return cors({
    origin: (origin) => {
      if (!origin) {
        return null;
      }
      if (opts?.allowLocalhost && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return origin;
      }
      return isAllowedApiOrigin(origin) ? origin : null;
    },
    allowMethods: API_ALLOWED_METHODS,
    allowHeaders: API_ALLOWED_HEADERS,
    exposeHeaders: ['X-Goldshore-Request-Id', 'Content-Length'],
    credentials: true,
    maxAge: 600,
  });
}
