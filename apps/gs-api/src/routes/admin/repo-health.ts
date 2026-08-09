/**
 * Admin Repo Health Route
 * GET /admin/repo-health — Repository health, audit findings, deployment status
 */

import { Hono } from 'hono';
import { buildRepoHealth, type RepoHealth } from '../../lib/github-repo-health';
import { Env, Variables } from '../../types';
import { getActor, logAdminAction, requirePermission } from '../../auth';

const repoHealth = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * Cache repo health in D1 with TTL
 */
async function getCachedHealth(
  db: D1Database,
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
async function cacheHealth(db: D1Database, cacheKey: string, health: RepoHealth): Promise<void> {
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
repoHealth.get('/', requirePermission('admin:repo-health:read'), async (c) => {
  const actor = getActor(c.get('accessClaims'), c.req.raw);
  const githubToken = c.env.GITHUB_API_TOKEN;

  if (!githubToken) {
    await logAdminAction(c.env, {
      action: 'admin.repo-health.read',
      actor,
      status: 'error',
      metadata: { error: 'GITHUB_API_TOKEN not configured' },
    });
    return c.json({ error: 'GitHub API token not configured' }, 503);
  }

  const cacheKey = 'marzton:goldshore-ai:health';
  const ttl = 300; // 5 minutes

  try {
    // Try to get cached version
    let health = await getCachedHealth(c.env.PLATFORM_DB, cacheKey, ttl);

    // If not cached or expired, fetch fresh data
    if (!health) {
      health = await buildRepoHealth('marzton', 'goldshore-ai', githubToken);
      await cacheHealth(c.env.PLATFORM_DB, cacheKey, health);
    }

    await logAdminAction(c.env, {
      action: 'admin.repo-health.read',
      actor,
      status: 'success',
      metadata: {
        health_score: health.health_score,
        critical_issues: health.security_summary.critical_issues,
      },
    });

    return c.json({
      success: true,
      data: health,
      cached: Boolean(health), // Simplified; could improve to track cache hit
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    await logAdminAction(c.env, {
      action: 'admin.repo-health.read',
      actor,
      status: 'error',
      metadata: { error: errorMsg },
    });

    return c.json({ error: errorMsg }, 500);
  }
});

/**
 * GET /admin/repo-health/findings?severity=critical&status=open
 * Filtered view of audit findings
 */
repoHealth.get('/findings', requirePermission('admin:repo-health:read'), async (c) => {
  const severity = c.req.query('severity'); // 'critical' | 'high' | 'medium' | 'low'
  const status = c.req.query('status'); // 'open' | 'in_progress' | 'resolved'

  const actor = getActor(c.get('accessClaims'), c.req.raw);
  const githubToken = c.env.GITHUB_API_TOKEN;

  if (!githubToken) {
    return c.json({ error: 'GitHub API token not configured' }, 503);
  }

  const cacheKey = 'marzton:goldshore-ai:health';
  const ttl = 300;

  try {
    let health = await getCachedHealth(c.env.PLATFORM_DB, cacheKey, ttl);

    if (!health) {
      health = await buildRepoHealth('marzton', 'goldshore-ai', githubToken);
      await cacheHealth(c.env.PLATFORM_DB, cacheKey, health);
    }

    let findings = health.findings;

    if (severity) {
      findings = findings.filter((f) => f.severity === severity);
    }

    if (status) {
      findings = findings.filter((f) => f.status === status);
    }

    await logAdminAction(c.env, {
      action: 'admin.repo-health.findings.read',
      actor,
      status: 'success',
      metadata: { count: findings.length, severity, status },
    });

    return c.json({
      success: true,
      data: findings,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMsg }, 500);
  }
});

export default repoHealth;
