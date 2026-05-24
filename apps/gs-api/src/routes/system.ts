import { Hono } from 'hono';
import { RoutingTableSchema, ServiceStatusSchema } from '@goldshore/schema';
import { requirePermission } from '../auth';
import { Env, Variables } from '../types';
import { getRuntimeVersion, withContractHeaders } from './contract';
import { parseConfig, resolveServiceStatusWithConfig } from './system.config';

const system = new Hono<{ Bindings: Env; Variables: Variables }>();

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
