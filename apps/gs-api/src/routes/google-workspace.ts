import { Hono } from 'hono';
import { requirePermission } from '../auth';
import {
  GoogleWorkspaceConfigurationError,
  GoogleWorkspaceProviderError,
  GoogleWorkspaceSyncInProgressError,
  isGoogleWorkspaceSyncConfigured,
  isGoogleWorkspaceSyncEnabled,
  syncGoogleWorkspaceRbac,
} from '../lib/google-workspace-rbac';
import type { Env, Variables } from '../types';

const googleWorkspace = new Hono<{ Bindings: Env; Variables: Variables }>();

googleWorkspace.get('/status', requirePermission('audit:read'), async (c) => {
  const [latest, counts] = await Promise.all([
    c.env.PLATFORM_DB.prepare(
      `SELECT id, status, started_at, completed_at, users_seen, users_granted,
              users_deprovisioned, conflicts, error_code, detail_json
         FROM google_workspace_sync_runs
        ORDER BY started_at DESC
        LIMIT 1`,
    ).first(),
    c.env.PLATFORM_DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active
         FROM google_workspace_users`,
    ).first<{ total: number; active: number | null }>(),
  ]);

  return c.json({
    enabled: isGoogleWorkspaceSyncEnabled(c.env),
    configured: isGoogleWorkspaceSyncConfigured(c.env),
    users: { total: counts?.total ?? 0, active: counts?.active ?? 0 },
    latestSync: latest ?? null,
  });
});

googleWorkspace.get('/users', requirePermission('users:read'), async (c) => {
  const requestedLimit = Number.parseInt(c.req.query('limit') ?? '100', 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 200)
    : 100;
  const result = await c.env.PLATFORM_DB.prepare(
    `SELECT google_id, primary_email, display_name, role, group_emails_json,
            active, last_seen_at, deprovisioned_at
       FROM google_workspace_users
      ORDER BY active DESC, primary_email
      LIMIT ?1`,
  ).bind(limit).all();
  return c.json({ users: result.results, limit });
});

googleWorkspace.post('/sync', requirePermission('users:update'), async (c) => {
  try {
    const result = await syncGoogleWorkspaceRbac(c.env);
    if (result.status === 'disabled') {
      return c.json({ error: 'Google Workspace synchronization is disabled.' }, 503);
    }
    return c.json(result);
  } catch (error) {
    if (error instanceof GoogleWorkspaceSyncInProgressError) {
      return c.json({ error: error.message }, 409);
    }
    if (error instanceof GoogleWorkspaceConfigurationError) {
      return c.json({ error: error.message }, 503);
    }
    if (error instanceof GoogleWorkspaceProviderError) {
      return c.json({ error: 'Google Workspace synchronization provider failed.' }, 502);
    }
    console.error({ event: 'google_workspace_manual_sync_error', error: String(error) });
    return c.json({ error: 'Google Workspace synchronization failed.' }, 500);
  }
});

export default googleWorkspace;
