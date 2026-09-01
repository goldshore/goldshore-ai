import type { Env, KeyType, Variables } from '../../types';
import { Hono } from 'hono';
import { verifyAdminAuth, parsePagination, errorHandler } from './middleware/auth';
import * as secretsDb from './db/secrets';

const VALID_KEY_TYPES: readonly KeyType[] = ['apiKey', 'apiSecret', 'webhook_secret', 'oauth_token'];

const secrets = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply auth middleware
secrets.use('*', verifyAdminAuth);
secrets.use('*', parsePagination);

/**
 * GET /api/admin/secrets
 * List all secrets (metadata only, no values)
 */
secrets.get('/', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const { offset, limit } = c.get('pagination');

  const result = await secretsDb.getSecrets(db, {
    offset,
    limit,
    integration_id: c.req.query('integration_id'),
    include_expired: c.req.query('include_expired') === 'true',
  });

  return c.json(result);
}));

/**
 * POST /api/admin/secrets
 * Create new secret (value encrypted at rest)
 * Expected body: { integration_id, key_type, value, expires_at? }
 */
secrets.post('/', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const currentUser = c.get('user');
  const body = await c.req.json();

  if (!body.integration_id || !body.key_type || !body.value) {
    return c.json(
      { error: 'Missing required fields: integration_id, key_type, value' },
      400
    );
  }

  if (!VALID_KEY_TYPES.includes(body.key_type)) {
    return c.json(
      { error: `Invalid key_type. Must be one of: ${VALID_KEY_TYPES.join(', ')}` },
      400
    );
  }

  await secretsDb.createSecret(c.env, {
    integration_id: body.integration_id,
    key_type: body.key_type,
    value: body.value,
    expires_at: body.expires_at,
    createdBy: currentUser.email,
  });

  console.log(`[AUDIT] ${currentUser.email} created secret: ${body.integration_id}/${body.key_type}`);

  return c.json({
    success: true,
    message: 'Secret created (value encrypted at rest)',
  }, 201);
}));

/**
 * PATCH /api/admin/secrets/:id
 * Rotate secret with new value
 * Expected body: { action: 'rotate', new_value }
 */
secrets.patch('/:id', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');
  const currentUser = c.get('user');
  const body = await c.req.json();

  if (body.action !== 'rotate' || !body.new_value) {
    return c.json({ error: 'Invalid request: action must be "rotate" with new_value' }, 400);
  }

  const secret = await secretsDb.getSecretById(db, id);
  if (!secret) {
    return c.json({ error: 'Secret not found' }, 404);
  }

  await secretsDb.rotateSecret(c.env, id, body.new_value, currentUser.email);

  console.log(`[AUDIT] ${currentUser.email} rotated secret: ${secret.integration_id}/${secret.key_type}`);

  return c.json({
    success: true,
    message: 'Secret rotated (new value encrypted at rest)',
  });
}));

/**
 * DELETE /api/admin/secrets/:id
 * Delete secret permanently
 */
secrets.delete('/:id', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');
  const currentUser = c.get('user');

  const secret = await secretsDb.getSecretById(db, id);
  if (!secret) {
    return c.json({ error: 'Secret not found' }, 404);
  }

  await secretsDb.deleteSecret(c.env, id, currentUser.email);

  console.log(`[AUDIT] ${currentUser.email} deleted secret: ${secret.integration_id}/${secret.key_type}`);

  return c.json({
    success: true,
    message: 'Secret deleted',
  });
}));

export default secrets;
