import { Hono } from 'hono';
import { requirePermission } from '../../auth';
import type { Env, Variables } from '../../types';

const router = new Hono<{ Bindings: Env; Variables: Variables }>();

const accountId = (env: Env) => env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
const zoneId = (env: Env) => env.CF_ZONE_ID || env.CLOUDFLARE_ZONE_ID;
const apiToken = (env: Env) => env.CF_TOKEN || env.CLOUDFLARE_API_TOKEN;

const requireCloudflare = (env: Env) => {
  const account = accountId(env);
  const token = apiToken(env);
  if (!account || !token) {
    const missing = [!account && 'CF_ACCOUNT_ID', !token && 'CF_TOKEN'].filter(Boolean);
    throw new Error(`Cloudflare control-plane credentials are incomplete: ${missing.join(', ')}`);
  }
  return { account, token };
};

const cf = async <T = any>(env: Env, path: string, init: RequestInit = {}): Promise<T> => {
  const { token } = requireCloudflare(env);
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || !payload || payload.success === false) {
    throw new Error(payload?.errors?.[0]?.message || `Cloudflare API request failed (${response.status}).`);
  }
  return payload;
};

const errorResponse = (c: any, error: unknown) =>
  c.json({ success: false, error: error instanceof Error ? error.message : 'Cloudflare request failed.' }, 502);

router.get('/overview', requirePermission('cloudflare_inventory:read'), async (c) => {
  const account = accountId(c.env);
  const zone = zoneId(c.env);
  const tokenConfigured = Boolean(apiToken(c.env));
  return c.json({
    success: Boolean(account && tokenConfigured),
    credentials: {
      accountIdConfigured: Boolean(account),
      apiTokenConfigured: tokenConfigured,
      zoneIdConfigured: Boolean(zone),
      canonicalNames: ['CF_ACCOUNT_ID', 'CF_TOKEN', 'CF_ZONE_ID'],
    },
    bindings: {
      KV: Boolean(c.env.KV),
      CONTROL_LOGS: Boolean(c.env.CONTROL_LOGS),
      PLATFORM_DB: Boolean(c.env.PLATFORM_DB),
      GS_ASSETS: Boolean(c.env.GS_ASSETS),
      AI: Boolean(c.env.AI),
      JOBS_QUEUE: Boolean(c.env.JOBS_QUEUE),
      EVENTS_QUEUE: Boolean(c.env.EVENTS_QUEUE),
      GS_SIGNALS: Boolean(c.env.GS_SIGNALS),
    },
  });
});

router.get('/workers', requirePermission('cloudflare_inventory:read'), async (c) => {
  try {
    const { account } = requireCloudflare(c.env);
    const data = await cf(c.env, `/accounts/${account}/workers/scripts`);
    return c.json({ success: true, items: data.result || [], pagination: data.result_info || null });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.get('/workers/:name/bindings', requirePermission('cloudflare_inventory:read'), async (c) => {
  try {
    const { account } = requireCloudflare(c.env);
    const name = c.req.param('name');
    const data = await cf(c.env, `/accounts/${account}/workers/scripts/${encodeURIComponent(name)}/settings`);
    const bindings = (data.result?.bindings || []).map((binding: any) => ({
      name: binding.name,
      type: binding.type,
      resource: binding.namespace_id || binding.database_id || binding.bucket_name || binding.service || binding.queue_name || binding.class_name || binding.script_name || 'configured',
    }));
    return c.json({ success: true, worker: name, items: bindings });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.get('/dns', requirePermission('cloudflare_inventory:read'), async (c) => {
  try {
    let zone = zoneId(c.env);
    if (!zone) {
      const zoneName = c.env.CLOUDFLARE_ZONE_NAME || 'goldshore.ai';
      const zones = await cf(c.env, `/zones?name=${encodeURIComponent(zoneName)}`);
      zone = zones.result?.[0]?.id;
    }
    if (!zone) return c.json({ success: false, error: 'No Cloudflare zone could be resolved.' }, 503);
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const perPage = Math.min(100, Math.max(10, Number(c.req.query('perPage')) || 50));
    const data = await cf(c.env, `/zones/${zone}/dns_records?page=${page}&per_page=${perPage}&order=name&direction=asc`);
    const items = (data.result || []).map((record: any) => ({
      id: record.id,
      type: record.type,
      name: record.name,
      content: record.content,
      proxied: record.proxied,
      ttl: record.ttl,
      modifiedOn: record.modified_on,
    }));
    return c.json({ success: true, zoneId: zone, items, pagination: data.result_info || null });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.get('/pages', requirePermission('cloudflare_inventory:read'), async (c) => {
  try {
    const { account } = requireCloudflare(c.env);
    const data = await cf(c.env, `/accounts/${account}/pages/projects`);
    const items = (data.result || []).map((project: any) => ({
      name: project.name,
      subdomain: project.subdomain,
      domains: project.domains || [],
      productionBranch: project.production_branch,
      createdOn: project.created_on,
      latestDeployment: project.latest_deployment ? {
        id: project.latest_deployment.id,
        environment: project.latest_deployment.environment,
        url: project.latest_deployment.url,
        createdOn: project.latest_deployment.created_on,
        status: project.latest_deployment.latest_stage?.status || project.latest_deployment.stages?.at?.(-1)?.status || 'unknown',
      } : null,
    }));
    return c.json({ success: true, items });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export default router;
