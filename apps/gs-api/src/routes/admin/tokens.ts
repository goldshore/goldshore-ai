import { Hono, type Context } from 'hono';
import type { Env, Variables } from '../../types';

const tokens = new Hono<{ Bindings: Env; Variables: Variables }>();

const verifyAdminAuth = (c: Context<{ Bindings: Env; Variables: Variables }>) => {
  const claims = c.get('accessClaims');
  if (!claims) {
    return { error: c.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { ok: true };
};

function generateTokenPrefix(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// GET /admin/tokens - List all API tokens
tokens.get('/', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  try {
    const result = await c.env.PLATFORM_DB.prepare(
      `SELECT id, name, prefix, last_used_at, expires_at, created_at, status
       FROM admin_tokens WHERE status = 'active' ORDER BY created_at DESC`
    ).all();

    const items = (result.results || []).map((token: any) => ({
      id: token.id,
      name: token.name,
      prefix: token.prefix,
      last_used_at: token.last_used_at,
      expires_at: token.expires_at,
      created_at: token.created_at,
      status: token.status,
    }));

    return c.json({
      items,
      total: items.length,
    });
  } catch (error) {
    console.error('[AUDIT] Token listing failed:', error);
    return c.json({ error: 'Failed to list tokens' }, { status: 500 });
  }
});

// POST /admin/tokens - Generate new API token
tokens.post('/', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  try {
    const body = await c.req.json<{
      name: string;
      expires_at?: string;
    }>();

    if (!body.name) {
      return c.json({ error: 'Token name is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const prefix = generateTokenPrefix();
    const randomSuffix = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    const fullToken = `gs_${prefix}_${randomSuffix}`;
    const now = new Date().toISOString();

    // Store token hash in KV for validation
    const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fullToken));
    const hashHex = Array.from(new Uint8Array(tokenHash)).map(b => b.toString(16).padStart(2, '0')).join('');

    await c.env.KV.put(
      `admin:token:${id}`,
      hashHex,
      { expirationTtl: body.expires_at ? Math.round((new Date(body.expires_at).getTime() - Date.now()) / 1000) : 31536000 }
    );

    // Store metadata in D1
    await c.env.PLATFORM_DB.prepare(
      `INSERT INTO admin_tokens (id, name, prefix, token_hash, expires_at, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`
    ).bind(id, body.name, prefix, hashHex, body.expires_at || null, now).run();

    console.log(`[AUDIT] Token created: ${body.name} by ${c.get('accessClaims')?.email}`);

    return c.json({
      id,
      name: body.name,
      prefix,
      token: fullToken,
      created_at: now,
      expires_at: body.expires_at || null,
      status: 'active',
    }, { status: 201 });
  } catch (error) {
    console.error('[AUDIT] Token creation failed:', error);
    return c.json({ error: 'Failed to create token' }, { status: 500 });
  }
});

// PATCH /admin/tokens/:id - Refresh/rotate token
tokens.patch('/:id', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  try {
    const id = c.req.param('id');
    const body = await c.req.json<{ action?: string }>();

    if (body.action !== 'refresh') {
      return c.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get existing token metadata
    const existing = await c.env.PLATFORM_DB.prepare(
      'SELECT name, expires_at FROM admin_tokens WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return c.json({ error: 'Token not found' }, { status: 404 });
    }

    const prefix = generateTokenPrefix();
    const randomSuffix = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    const fullToken = `gs_${prefix}_${randomSuffix}`;
    const now = new Date().toISOString();

    // Store new token hash
    const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fullToken));
    const hashHex = Array.from(new Uint8Array(tokenHash)).map(b => b.toString(16).padStart(2, '0')).join('');

    await c.env.KV.put(
      `admin:token:${id}`,
      hashHex,
      { expirationTtl: existing.expires_at ? Math.round((new Date(existing.expires_at).getTime() - Date.now()) / 1000) : 31536000 }
    );

    // Update metadata
    await c.env.PLATFORM_DB.prepare(
      'UPDATE admin_tokens SET prefix = ?, token_hash = ? WHERE id = ?'
    ).bind(prefix, hashHex, id).run();

    console.log(`[AUDIT] Token refreshed: ${id} by ${c.get('accessClaims')?.email}`);

    return c.json({
      id,
      name: existing.name,
      prefix,
      token: fullToken,
      status: 'active',
    });
  } catch (error) {
    console.error('[AUDIT] Token refresh failed:', error);
    return c.json({ error: 'Failed to refresh token' }, { status: 500 });
  }
});

// DELETE /admin/tokens/:id - Revoke token
tokens.delete('/:id', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  try {
    const id = c.req.param('id');

    await c.env.PLATFORM_DB.prepare(
      `UPDATE admin_tokens SET status = 'revoked' WHERE id = ?`
    ).bind(id).run();

    await c.env.KV.delete(`admin:token:${id}`);

    console.log(`[AUDIT] Token revoked: ${id} by ${c.get('accessClaims')?.email}`);

    return c.json({ success: true, message: 'Token revoked' });
  } catch (error) {
    console.error('[AUDIT] Token revocation failed:', error);
    return c.json({ error: 'Failed to revoke token' }, { status: 500 });
  }
});

export default tokens;
