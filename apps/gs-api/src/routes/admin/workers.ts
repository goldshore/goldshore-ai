import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { verifyAdminAuth, errorHandler } from './middleware/auth';

const workers = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

workers.use('*', verifyAdminAuth);

function cloudflareCredentials(env: Env) {
  return {
    token: env.CF_TOKEN ?? env.CLOUDFLARE_API_TOKEN,
    accountId: env.CF_ACCOUNT_ID ?? env.CLOUDFLARE_ACCOUNT_ID,
  };
}

workers.get('/workers', errorHandler(async (c) => {
  const { token: cf_token, accountId: cf_account_id } = cloudflareCredentials(c.env);

  if (!cf_token || !cf_account_id) {
    return c.json({
      error: 'Cloudflare API credentials not configured',
      workers: [],
    }, 503);
  }

  try {
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
    console.error('[Admin] Cloudflare API error:', error);
    return c.json({
      error: 'Failed to connect to Cloudflare API',
      workers: [],
    }, 500);
  }
}));

workers.get('/workers/:name', errorHandler(async (c) => {
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
    console.error('[Admin] Cloudflare API error:', error);
    return c.json({ error: 'Failed to fetch worker from Cloudflare' }, 500);
  }
}));

workers.get('/workers/:name/content', errorHandler(async (c) => {
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
  } catch (error) {
    console.error('[Admin] Cloudflare API error:', error);
    return c.json({ error: 'Failed to fetch worker content from Cloudflare' }, 500);
  }
}));

workers.post('/workers/:name/publish', errorHandler(async (c) => {
  const { token: cf_token, accountId: cf_account_id } = cloudflareCredentials(c.env);
  const workerName = c.req.param('name');
  const user = c.get('user');
  const body = await c.req.json() as any;

  if (!cf_token || !cf_account_id) {
    return c.json({ error: 'Cloudflare API credentials not configured' }, 503);
  }

  if (!body.script) {
    return c.json({ error: 'Worker script content is required' }, 400);
  }

  try {
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

    const data = await response.json() as any;
    console.log(`[AUDIT] ${user?.email ?? 'unknown'} deployed worker: ${workerName}`);

    return c.json({
      success: true,
      message: 'Worker deployed successfully',
      result: data.result || {},
    });
  } catch (error) {
    console.error('[Admin] Cloudflare API error:', error);
    return c.json({ error: 'Failed to deploy worker to Cloudflare' }, 500);
  }
}));

export default workers;
