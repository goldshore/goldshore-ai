import type { Context } from 'hono';
import type { Env, Variables } from '../../../types';

export interface PaginationOptions {
  offset: number;
  limit: number;
}

/**
 * Verify admin authentication via Cloudflare Access JWT
 */
export async function verifyAdminAuth(
  c: Context<{
    Bindings: Env;
    Variables: Variables;
  }>,
  next: () => Promise<void>
) {
  const claims = c.get('accessClaims');
  if (!claims) {
    return c.json({ error: 'Admin authentication required' }, 401);
  }

  // Extract user info from claims
  const user = {
    email: claims.email || 'unknown@goldshore.ai',
    name: claims.name || 'Unknown User',
    id: claims.sub || crypto.randomUUID(),
  };

  c.set('user', user);
  await next();
}

/**
 * Parse pagination query parameters with defaults
 * Supports both page-based and offset-based pagination
 */
export async function parsePagination(
  c: Context<{
    Bindings: Env;
    Variables: Variables;
  }>,
  next: () => Promise<void>
) {
  let offset = Math.max(0, parseInt(c.req.query('offset') || '0'));
  const limit = Math.min(1000, Math.max(1, parseInt(c.req.query('limit') || c.req.query('pageSize') || '50')));

  // If page is provided, convert to offset
  const page = c.req.query('page');
  if (page) {
    const pageNum = Math.max(1, parseInt(page));
    offset = (pageNum - 1) * limit;
  }

  c.set('pagination', { offset, limit });
  await next();
}

/**
 * Error handler wrapper for async route handlers
 */
export function errorHandler(handler: (c: any) => Promise<any>) {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      const user = c.get('user');
      const message = error instanceof Error ? error.message : String(error);

      console.error('[Admin Route Error]', {
        path: c.req.path,
        user: user?.email,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return c.json(
        {
          error: 'Internal server error',
          message: process.env.ENV === 'development' ? message : undefined,
        },
        500
      );
    }
  };
}
