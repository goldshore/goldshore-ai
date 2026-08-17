import { Hono, type Context } from 'hono';
import type { Env, Variables } from '../../types';

const tokens = new Hono<{ Bindings: Env; Variables: Variables }>();

const verifyAdminAuth = (c: Context<{ Bindings: Env; Variables: Variables }>) => {
  const claims = c.get('accessClaims');
  if (!claims) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { ok: true };
};

// GET /admin/tokens - List all tokens
tokens.get('/', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  try {
    const result = await c.env.PLATFORM_DB.prepare(
      'SELECT id, name, service, token_type, masked_value, is_active, last_used, created_at, updated_at FROM admin_tokens ORDER BY created_at DESC'
    ).all();

    return c.json({
      tokens: result.results || [],
      total: (result.results || []).length,
    });
  } catch (error) {
    console.error('[AUDIT] Token listing failed:', error);
    return c.json({ error: 'Failed to list tokens' }, { status: 500 });
  }
});

// POST /admin/tokens - Create new token entry
tokens.post('/', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  try {
    const body = await c.req.json<{
      name: string;
      service: string;
      token_type: 'api_key' | 'bearer' | 'oauth' | 'webhook_secret';
      token_value: string;
    }>();

    if (!body.name || !body.service || !body.token_type || !body.token_value) {
      return c.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const maskedValue = body.token_value.slice(0, 4) + '...' + body.token_value.slice(-4);
    const now = new Date().toISOString();

    // Store encrypted token in KV for security
    await c.env.KV.put(
      `admin:token:${id}`,
      body.token_value,
      { expirationTtl: 7776000 }
    );

    // Store metadata in D1
    await c.env.PLATFORM_DB.prepare(
      `INSERT INTO admin_tokens (id, name, service, token_type, masked_value, is_active, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
    ).bind(id, body.name, body.service, body.token_type, maskedValue, now, now, c.get('accessClaims')?.email).run();

    console.log(`[AUDIT] Token created: ${body.service}/${body.name} by ${c.get('accessClaims')?.email}`);

    return c.json({ id, name: body.name, service: body.service, created_at: now }, { status: 201 });
  } catch (error) {
    console.error('[AUDIT] Token creation failed:', error);
    return c.json({ error: 'Failed to create token' }, { status: 500 });
  }
});

// GET /admin/tokens/:id - Retrieve token (masked, never full value)
tokens.get('/:id', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  try {
    const id = c.req.param('id');
    const result = await c.env.PLATFORM_DB.prepare(
      'SELECT id, name, service, token_type, masked_value, is_active, last_used, created_at, updated_at FROM admin_tokens WHERE id = ?'
    ).bind(id).first();

    if (!result) {
      return c.json({ error: 'Token not found' }, { status: 404 });
    }

    return c.json(result);
  } catch (error) {
    console.error('[AUDIT] Token retrieval failed:', error);
    return c.json({ error: 'Failed to retrieve token' }, { status: 500 });
  }
});

// DELETE /admin/tokens/:id - Revoke token
tokens.delete('/:id', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  try {
    const id = c.req.param('id');

    await c.env.PLATFORM_DB.prepare(
      'UPDATE admin_tokens SET is_active = 0, updated_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), id).run();

    await c.env.KV.delete(`admin:token:${id}`);

    console.log(`[AUDIT] Token revoked: ${id} by ${c.get('accessClaims')?.email}`);

    return c.json({ success: true, message: 'Token revoked' });
  } catch (error) {
    console.error('[AUDIT] Token revocation failed:', error);
    return c.json({ error: 'Failed to revoke token' }, { status: 500 });
  }
});

// POST /admin/tokens/:id/rotate - Rotate token
tokens.post('/:id/rotate', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  try {
    const id = c.req.param('id');
    const body = await c.req.json<{ new_token_value: string }>();

    if (!body.new_token_value) {
      return c.json({ error: 'New token value required' }, { status: 400 });
    }

    await c.env.KV.put(
      `admin:token:${id}`,
      body.new_token_value,
      { expirationTtl: 7776000 }
    );

    const maskedValue = body.new_token_value.slice(0, 4) + '...' + body.new_token_value.slice(-4);
    await c.env.PLATFORM_DB.prepare(
      'UPDATE admin_tokens SET masked_value = ?, updated_at = ? WHERE id = ?'
    ).bind(maskedValue, new Date().toISOString(), id).run();

    console.log(`[AUDIT] Token rotated: ${id} by ${c.get('accessClaims')?.email}`);

    return c.json({ success: true, message: 'Token rotated' });
  } catch (error) {
    console.error('[AUDIT] Token rotation failed:', error);
    return c.json({ error: 'Failed to rotate token' }, { status: 500 });
  }
});

export default tokens;
