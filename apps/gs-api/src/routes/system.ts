import { Hono } from 'hono';
import {
  RoutingTableSchema,
  ServiceStatusSchema,
  parseSystemSyncWritePayload,
} from '@goldshore/schema';
import { getActor, logAdminAction, requirePermission } from '../auth';
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

const cloudflareRequest = async (env: Env, path: string, init: RequestInit = {}) => {
  if (!env.CLOUDFLARE_API_TOKEN) {
    throw new Error('Missing CLOUDFLARE_API_TOKEN');
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.errors?.[0]?.message ?? `Cloudflare request failed: ${response.status}`);
  }
  return payload;
};

type WorkerBinding = { name: string; type: string; [key: string]: unknown };
export const buildBindingPatch = (current: WorkerBinding[], bindingName: string, replacement?: WorkerBinding) => [
  ...current.filter((binding) => binding.name !== bindingName).map((binding) => ({ name: binding.name, type: 'inherit', version_id: 'latest' })),
  ...(replacement ? [replacement] : []),
];
const bindingRevision = async (bindings: WorkerBinding[]) => {
  const normalized = [...bindings].sort((a, b) => a.name.localeCompare(b.name));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(normalized)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};
const publicBinding = (binding: WorkerBinding) => {
  const safeFields = ['namespace_id', 'database_id', 'bucket_name', 'service', 'environment', 'queue_name', 'dataset', 'class_name', 'script_name', 'instance_name'];
  const resource = safeFields.map((field) => binding[field]).find((value) => typeof value === 'string') ??
    (binding.type === 'plain_text' ? 'Configured text value' : binding.type === 'json' ? 'Configured JSON value' : 'Configured');
  return { name: binding.name, type: binding.type, resource, editable: binding.type === 'plain_text' || binding.type === 'json' };
};
const patchWorkerBindings = async (env: Env, script: string, bindings: WorkerBinding[]) => {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) throw new Error('Cloudflare credentials are not configured.');
  const form = new FormData();
  form.set('settings', JSON.stringify({ bindings }));
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${encodeURIComponent(script)}/settings`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, body: form,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) throw new Error(payload?.errors?.[0]?.message ?? `Cloudflare request failed: ${response.status}`);
  return payload;
};

const executeAutomation = async (c: any, action: string, operation: () => Promise<unknown>) => {
  const claims = c.get('accessClaims');
  const timestamp = new Date().toISOString();

  try {
    const result = await operation();
    await writeControlLog(c.env, `${action}_${Date.now()}`, {
      action,
      user: claims?.email,
      timestamp,
      status: 'success',
      result,
    });
    return c.json({ success: true, action, status: 'success', result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Automation failed';
    await writeControlLog(c.env, `${action}_${Date.now()}`, {
      action,
      user: claims?.email,
      timestamp,
      status: 'error',
      error: message,
    });
    return c.json({ success: false, action, status: 'error', error: message }, 502);
  }
};

const applyDns = async (env: Env) => {
  if (!env.CLOUDFLARE_ZONE_ID) throw new Error('Missing CLOUDFLARE_ZONE_ID');
  const table = (await env.KV.get('ROUTING_TABLE', 'json')) as Record<string, { target?: string }> | null;
  const entries = Object.entries(table ?? {}).filter(([, config]) => config.target);

  const results = [];
  for (const [hostname, config] of entries) {
    const target = new URL(config.target as string).hostname;
    const name = env.CLOUDFLARE_ZONE_NAME ? hostname.replace(`.${env.CLOUDFLARE_ZONE_NAME}`, '') : hostname;
    const existing = await cloudflareRequest(
      env,
      `/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`,
    );
    const record = existing.result?.[0];
    const body = JSON.stringify({ type: 'CNAME', name, content: target, proxied: true, ttl: 1 });
    const updated = record
      ? await cloudflareRequest(env, `/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records/${record.id}`, { method: 'PATCH', body })
      : await cloudflareRequest(env, `/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records`, { method: 'POST', body });
    results.push({ hostname, target, id: updated.result?.id });
  }
  return { updated: results.length, records: results };
};

const reconcileWorkers = async (env: Env) => {
  if (!env.CLOUDFLARE_ACCOUNT_ID) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID');
  const deployments = await cloudflareRequest(env, `/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/services/gs-api/environments/production/deployments`);
  return { checkedService: 'gs-api', latestDeployment: deployments.result?.[0]?.id ?? null };
};

const deployPages = async (env: Env) => {
  if (!env.CLOUDFLARE_ACCOUNT_ID) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID');
  const project = env.CLOUDFLARE_PAGES_PROJECT ?? 'gs-web';
  return cloudflareRequest(env, `/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${project}/deployments`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
};

const auditAccess = async (env: Env) => {
  if (!env.CLOUDFLARE_ACCOUNT_ID) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID');
  const apps = await cloudflareRequest(env, `/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/access/apps`);
  const policies = await cloudflareRequest(env, `/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/access/policies`);
  return { applications: apps.result?.length ?? 0, policies: policies.result?.length ?? 0 };
};

system.get('/cf/workers', requirePermission('system:read'), async (c) => {
  if (!c.env.CLOUDFLARE_ACCOUNT_ID) {
    return c.json({ success: false, error: 'Missing CLOUDFLARE_ACCOUNT_ID' }, 503);
  }
  try {
    const data = await cloudflareRequest(c.env, `/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts`);
    return c.json({ success: true, accountId: c.env.CLOUDFLARE_ACCOUNT_ID, workers: data.result ?? [] });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to list workers' }, 502);
  }
});

system.get('/cf/workers/:name', requirePermission('system:read'), async (c) => {
  const name = c.req.param('name');
  if (!c.env.CLOUDFLARE_ACCOUNT_ID) {
    return c.json({ success: false, error: 'Missing CLOUDFLARE_ACCOUNT_ID' }, 503);
  }

  try {
    const settings = await cloudflareRequest(
      c.env,
      `/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${encodeURIComponent(name)}/settings`,
    );
    const bindings = (settings.result?.bindings ?? []) as WorkerBinding[];
    const bindingsRevision = await bindingRevision(bindings);

    let routes: Array<{ pattern: string }> = [];
    if (c.env.CLOUDFLARE_ZONE_ID) {
      try {
        const routesData = await cloudflareRequest(c.env, `/zones/${c.env.CLOUDFLARE_ZONE_ID}/workers/routes`);
        routes = ((routesData.result ?? []) as Array<{ id?: string; pattern: string; script?: string }>)
          .filter((route) => route.script === name)
          .map((route) => ({ id: route.id, pattern: route.pattern, zone_name: c.env.CLOUDFLARE_ZONE_NAME ?? 'goldshore.ai' }));
      } catch {
        // Zone routes are best-effort; a Worker can still be shown without them.
      }
    }

    return c.json({ success: true, name, bindings: bindings.map(publicBinding), bindingsRevision, routes });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load worker detail' }, 502);
  }
});

const workerNamePattern = /^[a-z0-9][a-z0-9-]{0,62}$/;
const allowedRouteHost = (pattern: string) => {
  const host = pattern.split('/')[0].replace(/^\*\./, '').toLowerCase();
  return host === 'goldshore.ai' || host.endsWith('.goldshore.ai') || host === 'goldshore.org' || host.endsWith('.goldshore.org');
};

const bindingNamePattern = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
system.put('/cf/workers/:name/bindings/:binding', requirePermission('cloudflare_inventory:manage'), async (c) => {
  const script = c.req.param('name');
  const bindingName = c.req.param('binding');
  if (!c.env.CLOUDFLARE_ACCOUNT_ID) return c.json({ error: 'Missing CLOUDFLARE_ACCOUNT_ID.' }, 503);
  const body = await c.req.json<{ type?: 'plain_text' | 'json'; value?: unknown; expectedRevision?: string; confirm?: boolean }>().catch(() => null);
  if (!body?.confirm) return c.json({ error: 'Explicit confirmation is required.' }, 409);
  if (!workerNamePattern.test(script) || !bindingNamePattern.test(bindingName) || !['plain_text', 'json'].includes(body.type ?? '')) return c.json({ error: 'Invalid Worker, binding name, or binding type.' }, 400);
  const serialized = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);
  if (!serialized || serialized.length > 16_384) return c.json({ error: 'Binding values must be between 1 and 16384 characters.' }, 400);
  try {
    const settings = await cloudflareRequest(c.env, `/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${encodeURIComponent(script)}/settings`);
    const current = (settings.result?.bindings ?? []) as WorkerBinding[];
    const revision = await bindingRevision(current);
    if (!body.expectedRevision || body.expectedRevision !== revision) return c.json({ error: 'Worker bindings changed since this page loaded. Refresh before retrying.', currentRevision: revision }, 409);
    const existing = current.find((binding) => binding.name === bindingName);
    if (existing && !['plain_text', 'json'].includes(existing.type)) return c.json({ error: 'Resource and secret bindings cannot be replaced from this editor.' }, 409);
    const replacement: WorkerBinding = body.type === 'json'
      ? { name: bindingName, type: 'json', json: body.value }
      : { name: bindingName, type: 'plain_text', text: String(body.value) };
    const result = await patchWorkerBindings(c.env, script, buildBindingPatch(current, bindingName, replacement));
    const next = (result.result?.bindings ?? []) as WorkerBinding[];
    await logAdminAction(c.env, { action: 'cloudflare.binding.save', actor: getActor(c.get('accessClaims'), c.req.raw), status: 'success', metadata: { script, bindingName, bindingType: body.type } });
    return c.json({ success: true, binding: publicBinding(replacement), bindingsRevision: await bindingRevision(next) });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to save binding.' }, 502);
  }
});

system.delete('/cf/workers/:name/bindings/:binding', requirePermission('cloudflare_inventory:manage'), async (c) => {
  const script = c.req.param('name');
  const bindingName = c.req.param('binding');
  const expectedRevision = c.req.query('expectedRevision');
  if (!c.env.CLOUDFLARE_ACCOUNT_ID) return c.json({ error: 'Missing CLOUDFLARE_ACCOUNT_ID.' }, 503);
  if (c.req.query('confirm') !== 'true') return c.json({ error: 'Explicit confirmation is required.' }, 409);
  if (!workerNamePattern.test(script) || !bindingNamePattern.test(bindingName)) return c.json({ error: 'Invalid Worker or binding name.' }, 400);
  try {
    const settings = await cloudflareRequest(c.env, `/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${encodeURIComponent(script)}/settings`);
    const current = (settings.result?.bindings ?? []) as WorkerBinding[];
    const revision = await bindingRevision(current);
    if (!expectedRevision || expectedRevision !== revision) return c.json({ error: 'Worker bindings changed since this page loaded. Refresh before retrying.', currentRevision: revision }, 409);
    const existing = current.find((binding) => binding.name === bindingName);
    if (!existing) return c.json({ error: 'Binding not found.' }, 404);
    if (!['plain_text', 'json'].includes(existing.type)) return c.json({ error: 'Only plain text and JSON bindings can be deleted from this editor.' }, 409);
    await patchWorkerBindings(c.env, script, buildBindingPatch(current, bindingName));
    await logAdminAction(c.env, { action: 'cloudflare.binding.delete', actor: getActor(c.get('accessClaims'), c.req.raw), status: 'success', metadata: { script, bindingName, bindingType: existing.type } });
    return c.body(null, 204);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete binding.' }, 502);
  }
});

system.post('/cf/routes', requirePermission('cloudflare_inventory:manage'), async (c) => {
  if (!c.env.CLOUDFLARE_ZONE_ID) return c.json({ error: 'Missing CLOUDFLARE_ZONE_ID.' }, 503);
  const body = await c.req.json<{ pattern?: string; script?: string; confirm?: boolean }>().catch(() => null);
  const pattern = body?.pattern?.trim() ?? '';
  const script = body?.script?.trim() ?? '';
  if (!body?.confirm) return c.json({ error: 'Explicit confirmation is required.' }, 409);
  if (!workerNamePattern.test(script) || !pattern || pattern.length > 253 || !allowedRouteHost(pattern)) {
    return c.json({ error: 'A valid Worker and GoldShore route pattern are required.' }, 400);
  }
  try {
    const result = await cloudflareRequest(c.env, `/zones/${c.env.CLOUDFLARE_ZONE_ID}/workers/routes`, {
      method: 'POST', body: JSON.stringify({ pattern, script }),
    });
    await logAdminAction(c.env, { action: 'cloudflare.route.create', actor: getActor(c.get('accessClaims'), c.req.raw), status: 'success', metadata: { pattern, script, routeId: result.result?.id } });
    return c.json({ success: true, route: { id: result.result?.id, pattern, script } }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create route.' }, 502);
  }
});

system.delete('/cf/routes/:id', requirePermission('cloudflare_inventory:manage'), async (c) => {
  if (!c.env.CLOUDFLARE_ZONE_ID) return c.json({ error: 'Missing CLOUDFLARE_ZONE_ID.' }, 503);
  const confirm = c.req.query('confirm') === 'true';
  const routeId = c.req.param('id');
  if (!confirm) return c.json({ error: 'Explicit confirmation is required.' }, 409);
  if (!/^[a-f0-9]{16,64}$/i.test(routeId)) return c.json({ error: 'Invalid route identifier.' }, 400);
  try {
    await cloudflareRequest(c.env, `/zones/${c.env.CLOUDFLARE_ZONE_ID}/workers/routes/${encodeURIComponent(routeId)}`, { method: 'DELETE' });
    await logAdminAction(c.env, { action: 'cloudflare.route.delete', actor: getActor(c.get('accessClaims'), c.req.raw), status: 'success', metadata: { routeId } });
    return c.body(null, 204);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete route.' }, 502);
  }
});

system.post('/dns/apply', requirePermission('system:write'), (c) => executeAutomation(c, 'dns_apply', () => applyDns(c.env)));
system.post('/workers/reconcile', requirePermission('system:write'), (c) => executeAutomation(c, 'workers_reconcile', () => reconcileWorkers(c.env)));
system.post('/pages/deploy', requirePermission('system:write'), (c) => executeAutomation(c, 'pages_deploy', () => deployPages(c.env)));
system.post('/access/audit', requirePermission('system:write'), (c) => executeAutomation(c, 'access_audit', () => auditAccess(c.env)));

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
