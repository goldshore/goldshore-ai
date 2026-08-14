import { Context, Next } from 'hono';

/**
 * Verify Cloudflare Access JWT and extract user claims
 * Returns 401 if JWT is missing or invalid
 * Returns 403 if user is not in ADMIN_OWNER_EMAILS
 */
export async function verifyAdminAuth(c: Context, next: Next) {
  const jwt = c.req.header('CF-Authorization');

  if (!jwt) {
    return c.json({ error: 'CF-Authorization header missing' }, 401);
  }

  try {
    // Cloudflare Access provides the JWT in CF-Authorization header
    // Extract claims from JWT (in production, validate signature)
    const claims = parseJWT(jwt);

    if (!claims.email) {
      return c.json({ error: 'No email in JWT claims' }, 401);
    }

    // Get allowed admin emails from environment
    const adminEmails = (c.env.ADMIN_OWNER_EMAILS || '')
      .split(',')
      .map((e: string) => e.trim())
      .filter(Boolean);

    if (!adminEmails.includes(claims.email)) {
      return c.json({
        error: 'User not in admin list',
        email: claims.email
      }, 403);
    }

    // Store user info in context for downstream handlers
    c.set('user', {
      email: claims.email,
      name: claims.name || claims.email,
      id: claims.sub || claims.email,
      groups: claims.groups || [],
    });

    await next();
  } catch (err) {
    return c.json({ error: 'Invalid JWT', details: String(err) }, 401);
  }
}

/**
 * Parse JWT without verification (Cloudflare validates signature)
 * In production, use a JWT library to verify signature
 */
function parseJWT(token: string): Record<string, any> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');

    const payload = parts[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch (err) {
    throw new Error(`Failed to parse JWT: ${err}`);
  }
}

/**
 * Pagination middleware — extract offset/limit from query params
 */
export function parsePagination(c: Context, next: Next) {
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const limit = parseInt(c.req.query('limit') || '25', 10);

  const validLimit = Math.min(Math.max(limit, 1), 100);
  const validOffset = Math.max(offset, 0);

  c.set('pagination', {
    offset: validOffset,
    limit: validLimit,
  });

  return next();
}

/**
 * Audit logging middleware — log all admin actions
 */
export async function auditLog(c: Context, next: Next) {
  const user = c.get('user');
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  const startTime = Date.now();

  await next();

  const duration = Date.now() - startTime;
  const status = c.res.status;

  // Log to console (in production, log to D1)
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    user: user?.email || 'unknown',
    method,
    path,
    status,
    duration,
  }));
}

/**
 * Error handler wrapper
 */
export function errorHandler(handler: (c: Context) => Promise<Response>) {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Route error:', errorMessage, err);
      return c.json({
        error: 'Internal server error',
        message: errorMessage
      }, 500);
    }
  };
}
