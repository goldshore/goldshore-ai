/**
 * SSRF Protection Middleware
 *
 * Prevents Server-Side Request Forgery attacks via nested-encoded path traversal.
 * Blocks sequences like %252e%252e that decode to .. after multiple layers,
 * preventing attackers from using URL encoding to escape /v1/ prefix.
 */

import type { Context, Next } from 'hono';
import type { Env, Variables } from '../types';

function recursivelyDecodePath(path: string): string | null {
  let decodedPath = path;

  for (let depth = 0; depth < 5; depth++) {
    try {
      const nextPath = decodeURIComponent(decodedPath);
      if (nextPath === decodedPath) {
        return decodedPath;
      }
      decodedPath = nextPath;
    } catch {
      return null;
    }
  }

  return null;
}

function validatePath(path: string): boolean {
  if (!path.startsWith('/v1/')) {
    return false;
  }

  if (path.includes('..') || path.includes('%2e%2e')) {
    return false;
  }

  const decodedPath = recursivelyDecodePath(path);
  if (!decodedPath) {
    return false;
  }

  if (decodedPath.includes('..')) {
    return false;
  }

  return true;
}

export async function ssrfProtectionMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  if (c.req.path.startsWith('/v1/')) {
    if (!validatePath(c.req.path)) {
      return c.text('Invalid path', 400);
    }
  }
  await next();
}
