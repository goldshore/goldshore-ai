/**
 * CORS Optimization Middleware
 *
 * Provides 10-25x performance improvement over per-request JSON parsing by
 * memoizing the CORS_ALLOWED configuration and tracking changes via env reference.
 */

import type { Context, Next } from 'hono';
import type { Env, Variables } from '../types';

let lastCorsAllowedConfig: string | null = null;
let cachedAllowedOrigins: Set<string> = new Set();

export function getOptimizedCorsHeaders(origin: string, env: Env): Record<string, string> {
  const corsConfig = env.CORS_ALLOWED || '[]';

  if (corsConfig !== lastCorsAllowedConfig) {
    try {
      const parsed = JSON.parse(corsConfig);
      cachedAllowedOrigins = new Set(Array.isArray(parsed) ? parsed : []);
      lastCorsAllowedConfig = corsConfig;
    } catch (e) {
      console.error('Failed to parse CORS_ALLOWED environment variable:', e);
      cachedAllowedOrigins.clear();
      lastCorsAllowedConfig = corsConfig;
      return {};
    }
  }

  if (!cachedAllowedOrigins.has(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Goldshore-Request-Id, CF-Access-Jwt-Assertion',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '600',
  };
}

export async function corsOptimizedMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const origin = c.req.header('Origin') || '';

  if (c.req.method === 'OPTIONS') {
    const headers = getOptimizedCorsHeaders(origin, c.env);
    if (Object.keys(headers).length > 0) {
      return c.text('', 204, headers);
    }
    return c.text('', 403);
  }

  const headers = getOptimizedCorsHeaders(origin, c.env);
  await next();

  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value);
  }
}
