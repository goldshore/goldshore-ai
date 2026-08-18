import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { verifyAdminAuth, errorHandler } from './middleware/auth';

const workers = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply auth middleware
workers.use('*', verifyAdminAuth);

/**
 * GET /api/admin/cf/workers
 * List all Cloudflare Workers in the account
 */
workers.get('/cf/workers', errorHandler(async (c) => {
  const cf_token = c.env.CLOUDFLARE_API_TOKEN;
  const cf_account_id = c.env.CLOUDFLARE_ACCOUNT_ID;

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
      const error = await response.json().catch(() => ({}));
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

/**
 * GET /api/admin/cf/workers/:name
 * Get single worker details
 */
workers.get('/cf/workers/:name', errorHandler(async (c) => {
  const cf_token = c.env.CLOUDFLARE_API_TOKEN;
  const cf_account_id = c.env.CLOUDFLARE_ACCOUNT_ID;
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
      const error = await response.json().catch(() => ({}));
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

/**
 * GET /api/admin/cf/workers/:name/content
 * Get worker script content
 */
workers.get('/cf/workers/:name/content', errorHandler(async (c) => {
  const cf_token = c.env.CLOUDFLARE_API_TOKEN;
  const cf_account_id = c.env.CLOUDFLARE_ACCOUNT_ID;
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
      const error = await response.json().catch(() => ({}));
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

/**
 * POST /api/admin/cf/workers/:name/publish
 * Deploy/publish worker code
 */
workers.post('/cf/workers/:name/publish', errorHandler(async (c) => {
  const cf_token = c.env.CLOUDFLARE_API_TOKEN;
  const cf_account_id = c.env.CLOUDFLARE_ACCOUNT_ID;
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
      const error = await response.json().catch(() => ({}));
      return c.json(
        { error: error.errors?.[0]?.message || 'Failed to deploy worker' },
        response.status
      );
    }

    const data = await response.json() as any;

    console.log(`[AUDIT] ${user.email} deployed worker: ${workerName}`);

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
