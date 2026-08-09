import { Hono } from 'hono';
import {
  RoutingTableSchema,
  ServiceStatusSchema,
  parseSystemSyncWritePayload,
} from '@goldshore/schema';
import { requirePermission } from '../auth';
import { Env, Variables } from '../types';
import { getRuntimeVersion, withContractHeaders } from './contract';
import { parseConfig, resolveServiceStatusWithConfig } from './system.config';

const system = new Hono<{ Bindings: Env; Variables: Variables }>();


const getRequiredRoles = (env: Env) =>
  (env.CONTROL_ADMIN_ROLES ?? 'admin,system-admin')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);

const isAuthorizedRole = (claims: Variables['accessClaims'], requiredRoles: string[]) => {
  const claimSet = claims as (Variables['accessClaims'] & { roles?: string[]; groups?: string[] }) | null;
  const roles = [
    ...(Array.isArray(claimSet?.roles) ? claimSet.roles : []),
    ...(Array.isArray(claimSet?.groups) ? claimSet.groups : []),
  ];

  return roles.some((role) => requiredRoles.includes(role));
};

const writeControlLog = async (env: Env, key: string, payload: unknown) => {
  if (!env.CONTROL_LOGS) return;
  await env.CONTROL_LOGS.put(key, JSON.stringify(payload));
};



system.post('/sync', requirePermission('system:write'), async (c) => {
  const claims = c.get('accessClaims');
  const requiredRoles = getRequiredRoles(c.env);

  if (!isAuthorizedRole(claims, requiredRoles)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parsedPayload = parseSystemSyncWritePayload(body);

  if (!parsedPayload.success) {
    return c.json(
      {
        error: 'Validation Failed',
        details: parsedPayload.error.format(),
      },
      400,
    );
  }

  const timestamp = new Date().toISOString();
  await Promise.all([
    c.env.KV.put('ROUTING_TABLE', JSON.stringify(parsedPayload.data.ROUTING_TABLE)),
    c.env.KV.put('SERVICE_STATUS', JSON.stringify(parsedPayload.data.SERVICE_STATUS)),
    c.env.KV.put('AI_ORCHESTRATION', JSON.stringify(parsedPayload.data.AI_ORCHESTRATION)),
    writeControlLog(c.env, `sync_${Date.now()}`, {
      user: claims?.email,
      timestamp,
    }),
  ]);

  return c.json({ success: true, syncedAt: timestamp });
});

const automationAccepted = async (c: any, action: string) => {
  const claims = c.get('accessClaims');
  await writeControlLog(c.env, `${action}_${Date.now()}`, {
    action,
    user: claims?.email,
    timestamp: new Date().toISOString(),
    status: 'accepted',
  });

  return c.json({ success: true, action, status: 'accepted' });
};

system.post('/dns/apply', requirePermission('system:write'), (c) => automationAccepted(c, 'dns_apply'));
system.post('/workers/reconcile', requirePermission('system:write'), (c) => automationAccepted(c, 'workers_reconcile'));
system.post('/pages/deploy', requirePermission('system:write'), (c) => automationAccepted(c, 'pages_deploy'));
system.post('/access/audit', requirePermission('system:write'), (c) => automationAccepted(c, 'access_audit'));

/**
 * [SOP] System Configuration & Status
 * Provides versioning and active service metadata.
 */
system.get('/status', requirePermission('system:read'), async (c) => {
  const { serviceStatus } = await resolveServiceStatusWithConfig(c.env.KV);

  const result = ServiceStatusSchema.safeParse(serviceStatus);

  if (!result.success) {
    return c.json(
      {
        status: 'degraded',
        error: 'Invalid service status configuration',
        version: '2026.03.03',
      },
      500,
    );
  }

  return c.json({
    status: 'operational',
    ...result.data,
  });
});

system.get('/routing', requirePermission('system:read'), async (c) => {
  const table = await c.env.KV.get('ROUTING_TABLE', 'json');
  const result = RoutingTableSchema.safeParse(table);

  return c.json({
    success: result.success,
    data: result.success ? result.data : {},
  });
});

system.get('/config', requirePermission('system:read'), async (c) => {
  const { serviceStatus, migrationApplied } = await resolveServiceStatusWithConfig(c.env.KV);

  return c.json({
    config: parseConfig(serviceStatus.api_config),
    source: {
      key: 'SERVICE_STATUS.api_config',
      migrationApplied,
      legacyKey: 'gs-api:config',
    },
  });
});

system.put('/config', requirePermission('system:write'), async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid configuration payload.' }, 400);
  }

  const { serviceStatus } = await resolveServiceStatusWithConfig(c.env.KV);
  const nextConfig = parseConfig(body);
  const nextStatus = {
    ...serviceStatus,
    api_config: {
      ...nextConfig,
      migratedFromLegacy: serviceStatus.api_config?.migratedFromLegacy ?? false,
    },
  };

  await c.env.KV.put('SERVICE_STATUS', JSON.stringify(nextStatus));

  return c.json({
    config: nextStatus.api_config,
    source: {
      key: 'SERVICE_STATUS.api_config',
      migrationApplied: false,
      legacyKey: 'gs-api:config',
    },
  });
});

system.get('/version', requirePermission('system:read'), (c) =>
  c.json(
    withContractHeaders(
      {
        service: 'gs-api',
        version: c.env.API_VERSION ?? c.env.GIT_SHA ?? 'unknown',
        deploySha: c.env.DEPLOY_SHA ?? c.env.GIT_SHA ?? null,
      },
      getRuntimeVersion(c.env)
    )
  ),
);

export default system;
