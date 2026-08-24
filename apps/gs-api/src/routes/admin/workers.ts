import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { verifyAdminAuth, errorHandler } from './middleware/auth';

const workers = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

workers.use('*', verifyAdminAuth);

const cfToken = (env: Env) => env.CF_TOKEN || env.CLOUDFLARE_API_TOKEN;
const cfAccountId = (env: Env) => env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
const cfZoneId = (env: Env) => env.CF_ZONE_ID || env.CLOUDFLARE_ZONE_ID;
function cloudflareCredentials(env: Env) {
  return {
    token: env.CF_TOKEN ?? env.CLOUDFLARE_API_TOKEN,
    accountId: env.CF_ACCOUNT_ID ?? env.CLOUDFLARE_ACCOUNT_ID,
  };
}

workers.get('/workers', errorHandler(async (c) => {
  const { token: cf_token, accountId: cf_account_id } = cloudflareCredentials(c.env);

const requireCloudflare = (env: Env) => {
  const token = cfToken(env);
  const accountId = cfAccountId(env);
  if (!token || !accountId) {
    const missing = [!accountId && 'CF_ACCOUNT_ID', !token && 'CF_TOKEN'].filter(Boolean).join(', ');
    throw new Error(`Cloudflare API credentials not configured: ${missing}`);
  }
  return { token, accountId };
};

const cfRequest = async (env: Env, path: string, init: RequestInit = {}) => {
  const { token } = requireCloudflare(env);
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers || {}),
    },
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');
  if (!response.ok || (payload as any)?.success === false) {
    const message = (payload as any)?.errors?.[0]?.message || `Cloudflare API request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as any;
};

workers.get('/overview', errorHandler(async (c) => {
  return c.json({
    success: Boolean(cfAccountId(c.env) && cfToken(c.env)),
    credentials: {
      accountIdConfigured: Boolean(cfAccountId(c.env)),
      apiTokenConfigured: Boolean(cfToken(c.env)),
      zoneIdConfigured: Boolean(cfZoneId(c.env)),
      canonicalNames: ['CF_ACCOUNT_ID', 'CF_TOKEN', 'CF_ZONE_ID'],
    },
    runtimeBindings: {
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
}));

workers.get('/workers', errorHandler(async (c) => {
  try {
    const { accountId } = requireCloudflare(c.env);
    const data = await cfRequest(c.env, `/accounts/${accountId}/workers/scripts`);
    return c.json({ success: true, items: data.result || [], total: (data.result || []).length });
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cf_account_id}/workers/scripts`,
      {
        headers: {
          'Authorization': `Bearer ${cf_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      return c.json({
        error: error.errors?.[0]?.message || 'Failed to fetch workers from Cloudflare',
        workers: [],
      }, response.status);
    }

    const data = await response.json() as any;
    return c.json({
      workers: data.result || [],
      total: (data.result || []).length,
    });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to list Workers.', items: [] }, 502);
  }
}));

workers.get('/workers/:name', errorHandler(async (c) => {
  try {
    const { accountId } = requireCloudflare(c.env);
    const workerName = c.req.param('name');
    const data = await cfRequest(c.env, `/accounts/${accountId}/workers/scripts/${encodeURIComponent(workerName)}/settings`);
    const bindings = (data.result?.bindings || []).map((binding: any) => ({
      name: binding.name,
      type: binding.type,
      resource: binding.namespace_id || binding.database_id || binding.bucket_name || binding.service || binding.queue_name || binding.class_name || binding.script_name || 'configured',
    }));
    return c.json({ success: true, name: workerName, bindings, settings: data.result || {} });
  const { token: cf_token, accountId: cf_account_id } = cloudflareCredentials(c.env);
  const workerName = c.req.param('name');

  if (!cf_token || !cf_account_id) {
    return c.json({ error: 'Cloudflare API credentials not configured' }, 503);
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cf_account_id}/workers/scripts/${workerName}`,
      {
        headers: {
          'Authorization': `Bearer ${cf_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      return c.json(
        { error: error.errors?.[0]?.message || 'Worker not found' },
        response.status
      );
    }

    const data = await response.json() as any;
    return c.json(data.result || {});
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Worker not found.' }, 502);
  }
}));

workers.get('/workers/:name/content', errorHandler(async (c) => {
  try {
    const { token, accountId } = requireCloudflare(c.env);
    const workerName = c.req.param('name');
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${encodeURIComponent(workerName)}`, {
      headers: { Authorization: `Bearer ${token}` },
  const { token: cf_token, accountId: cf_account_id } = cloudflareCredentials(c.env);
  const workerName = c.req.param('name');

  if (!cf_token || !cf_account_id) {
    return c.json({ error: 'Cloudflare API credentials not configured' }, 503);
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cf_account_id}/workers/scripts/${workerName}`,
      {
        headers: {
          'Authorization': `Bearer ${cf_token}`,
          'Content-Type': 'application/javascript',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      return c.json(
        { error: error.errors?.[0]?.message || 'Worker not found' },
        response.status
      );
    }

    const content = await response.text();
    return c.text(content, 200, {
      'Content-Type': 'application/javascript',
    });
    if (!response.ok) throw new Error(`Worker content request failed (${response.status}).`);
    return c.body(await response.text(), 200, { 'Content-Type': response.headers.get('content-type') || 'application/javascript' });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch Worker content.' }, 502);
  }
}));

workers.post('/workers/:name/publish', errorHandler(async (c) => {
  const body = await c.req.json<{ script?: string }>().catch(() => null);
  if (!body?.script) return c.json({ error: 'Worker script content is required' }, 400);
  try {
    const { token, accountId } = requireCloudflare(c.env);
    const workerName = c.req.param('name');
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${encodeURIComponent(workerName)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/javascript' },
      body: body.script,
    });
    const data = await response.json().catch(() => null) as any;
    if (!response.ok || data?.success === false) throw new Error(data?.errors?.[0]?.message || `Publish failed (${response.status}).`);
    const user = c.get('user');
    console.log(`[AUDIT] ${user?.email || 'admin'} deployed worker: ${workerName}`);
    return c.json({ success: true, message: 'Worker deployed successfully', result: data?.result || {} });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to deploy Worker.' }, 502);
  }
}));

workers.get('/dns', errorHandler(async (c) => {
  try {
    let zoneId = cfZoneId(c.env);
    if (!zoneId) {
      const zoneName = c.env.CLOUDFLARE_ZONE_NAME || 'goldshore.ai';
      const zones = await cfRequest(c.env, `/zones?name=${encodeURIComponent(zoneName)}`);
      zoneId = zones.result?.[0]?.id;
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cf_account_id}/workers/scripts/${workerName}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${cf_token}`,
          'Content-Type': 'application/javascript',
        },
        body: body.script,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      return c.json(
        { error: error.errors?.[0]?.message || 'Failed to deploy worker' },
        response.status
      );
    }
    if (!zoneId) return c.json({ success: false, error: 'No Cloudflare zone could be resolved.', items: [] }, 503);
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const perPage = Math.min(100, Math.max(10, Number(c.req.query('perPage')) || 50));
    const data = await cfRequest(c.env, `/zones/${zoneId}/dns_records?page=${page}&per_page=${perPage}&order=name&direction=asc`);
    return c.json({
      success: true,
      zoneId,
      items: (data.result || []).map((record: any) => ({
        id: record.id,
        type: record.type,
        name: record.name,
        content: record.content,
        proxied: record.proxied,
        ttl: record.ttl,
        modifiedOn: record.modified_on,
      })),
      pagination: data.result_info || null,
    });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to list DNS records.', items: [] }, 502);
  }
}));

    const data = await response.json() as any;
    console.log(`[AUDIT] ${user?.email ?? 'unknown'} deployed worker: ${workerName}`);

workers.get('/pages', errorHandler(async (c) => {
  try {
    const { accountId } = requireCloudflare(c.env);
    const data = await cfRequest(c.env, `/accounts/${accountId}/pages/projects`);
    return c.json({
      success: true,
      items: (data.result || []).map((project: any) => ({
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
      })),
    });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to list Pages projects.', items: [] }, 502);
  }
}));

export default workers;
