/**
 * Admin Repo Health Route
 * GET /admin/repo-health — Repository health, audit findings, deployment status
 */

import { Hono, type Context } from 'hono';
import { buildRepoHealth, type RepoHealth } from '../../lib/github-repo-health';
import { buildAdminSession } from '@goldshore/auth';
import type { Env, Variables } from '../../types';

const repoHealth = new Hono<{ Bindings: Env; Variables: Variables }>();

const verifyAdminAuth = (c: Context<{ Bindings: Env; Variables: Variables }>): { error: Response } | { ok: true } => {
  const claims = c.get('accessClaims');
  if (!claims) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const session = buildAdminSession(claims);
  if (!session.permissions.includes('admin:repo-health:read')) {
    return { error: Response.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  }
  return { ok: true };
};

/**
 * Cache repo health in D1 with TTL
 */
async function getCachedHealth(
  db: any,
  cacheKey: string,
  ttlSeconds: number
): Promise<RepoHealth | null> {
  try {
    const cached = await db
      .prepare(
        `SELECT data, last_updated FROM admin_cache
       WHERE id = ? AND entity_type = 'health'
       AND datetime(last_updated) > datetime('now', '-' || ? || ' seconds')`
      )
      .bind(cacheKey, ttlSeconds)
      .first();

    if (cached) {
      return JSON.parse(cached.data as string) as RepoHealth;
    }
  } catch (error) {
    console.error('Cache read error:', error);
  }

  return null;
}

/**
 * Store repo health in D1 cache
 */
async function cacheHealth(db: any, cacheKey: string, health: RepoHealth): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT OR REPLACE INTO admin_cache
       (id, entity_type, data, last_updated, ttl_seconds, cached_at)
       VALUES (?, 'health', ?, datetime('now'), 300, datetime('now'))`
      )
      .bind(cacheKey, JSON.stringify(health))
      .run();
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

/**
 * GET /admin/repo-health
 * Returns overall repo health, audit findings, and blockers
 */
repoHealth.get('/', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  const claims = c.get('accessClaims');
  const githubToken = c.env.GITHUB_API_TOKEN;
  const db = c.env.PLATFORM_DB;

  if (!githubToken) {
    console.warn('[AUDIT] admin.repo-health.read FAILED - GITHUB_API_TOKEN not configured', {
      actor: claims?.email || 'unknown'
    });
    return c.json({ error: 'GitHub API token not configured' }, 503);
  }

  const cacheKey = 'marzton:goldshore-ai:health';
  const ttl = 300; // 5 minutes

  try {
    // Try to get cached version
    let health = await getCachedHealth(db, cacheKey, ttl);

    // If not cached or expired, fetch fresh data
    if (!health) {
      health = await buildRepoHealth('marzton', 'goldshore-ai', githubToken);
      await cacheHealth(db, cacheKey, health);
    }

    console.info('[AUDIT] admin.repo-health.read SUCCESS', {
      actor: claims?.email || 'unknown',
      health_score: health?.health_score || 0,
      critical_issues: health?.security_summary?.critical_issues || 0,
      cached: Boolean(health),
    });

    return c.json({
      success: true,
      data: health || { error: 'Unable to fetch repo health' },
      cached: Boolean(health),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AUDIT] admin.repo-health.read FAILED', {
      actor: claims?.email || 'unknown',
      error: errorMsg,
    });
    return c.json({ error: errorMsg }, 500);
  }
});

/**
 * GET /admin/repo-health/findings?severity=critical&status=open
 * Filtered view of audit findings
 */
repoHealth.get('/findings', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  const claims = c.get('accessClaims');
  const severity = c.req.query('severity'); // 'critical' | 'high' | 'medium' | 'low'
  const status = c.req.query('status'); // 'open' | 'in_progress' | 'resolved'

  const githubToken = c.env.GITHUB_API_TOKEN;
  const db = c.env.PLATFORM_DB;

  if (!githubToken) {
    return c.json({ error: 'GitHub API token not configured' }, 503);
  }

  const cacheKey = 'marzton:goldshore-ai:health';
  const ttl = 300;

  try {
    let health = await getCachedHealth(db, cacheKey, ttl);

    if (!health) {
      health = await buildRepoHealth('marzton', 'goldshore-ai', githubToken);
      if (health) {
        await cacheHealth(db, cacheKey, health);
      }
    }

    let findings = health?.findings || [];

    if (severity) {
      findings = findings.filter((f) => f.severity === severity);
    }

    if (status) {
      findings = findings.filter((f) => f.status === status);
    }

    console.info('[AUDIT] admin.repo-health.findings.read SUCCESS', {
      actor: claims?.email || 'unknown',
      count: findings.length,
      severity,
      status,
    });

    return c.json({
      success: true,
      data: findings,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AUDIT] admin.repo-health.findings.read FAILED', {
      actor: claims?.email || 'unknown',
      error: errorMsg,
    });
    return c.json({ error: errorMsg }, 500);
  }
});

export default repoHealth;
