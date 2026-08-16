import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { verifyAdminAuth, parsePagination, errorHandler } from './middleware/auth';
import * as secretsDb from './db/secrets';

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
    integration: c.req.query('integration'),
    isActive: c.req.query('active') === 'true',
  });

  return c.json(result);
}));

/**
 * GET /api/admin/secrets/:id
 * Get secret metadata (no encrypted value)
 */
secrets.get('/:id', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');

  const secret = await secretsDb.getSecretById(db, id);
  if (!secret) {
    return c.json({ error: 'Secret not found' }, 404);
  }

  return c.json(secret);
}));

/**
 * POST /api/admin/secrets
 * Create new secret (value encrypted by INTEGRATION_MASTER_KEY)
 */
secrets.post('/', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const currentUser = c.get('user');
  const body = await c.req.json();

  if (!body.name || !body.integration || !body.encryptedValue) {
    return c.json(
      { error: 'Missing required fields: name, integration, encryptedValue' },
      400
    );
  }

  // Check if secret already exists
  const existing = await secretsDb.getSecretByName(db, body.name);
  if (existing) {
    return c.json({ error: 'Secret with this name already exists' }, 409);
  }

  await secretsDb.createSecret(db, {
    name: body.name,
    integration: body.integration,
    encryptedValue: body.encryptedValue,
    type: body.type,
    createdBy: currentUser.email,
  });

  console.log(`[AUDIT] ${currentUser.email} created secret: ${body.name}`);

  return c.json({
    success: true,
    message: 'Secret created (value encrypted at rest)',
  }, 201);
}));

/**
 * POST /api/admin/secrets/:id/rotate
 * Rotate secret (generate new value, revoke old)
 */
secrets.post('/:id/rotate', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');
  const currentUser = c.get('user');
  const body = await c.req.json();

  if (!body.encryptedValue) {
    return c.json({ error: 'New encrypted value is required' }, 400);
  }

  const secret = await secretsDb.getSecretById(db, id);
  if (!secret) {
    return c.json({ error: 'Secret not found' }, 404);
  }

  await secretsDb.rotateSecret(db, id, body.encryptedValue, currentUser.email);

  console.log(`[AUDIT] ${currentUser.email} rotated secret: ${secret.name}`);

  return c.json({
    success: true,
    message: 'Secret rotated (new value encrypted at rest)',
  });
}));

/**
 * POST /api/admin/secrets/:id/revoke
 * Revoke secret (set is_active = 0)
 */
secrets.post('/:id/revoke', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');
  const currentUser = c.get('user');

  const secret = await secretsDb.getSecretById(db, id);
  if (!secret) {
    return c.json({ error: 'Secret not found' }, 404);
  }

  await secretsDb.revokeSecret(db, id, currentUser.email);

  console.log(`[AUDIT] ${currentUser.email} revoked secret: ${secret.name}`);

  return c.json({
    success: true,
    message: 'Secret revoked',
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

  await secretsDb.deleteSecret(db, id);

  console.log(`[AUDIT] ${currentUser.email} deleted secret: ${secret.name}`);

  return c.json({
    success: true,
    message: 'Secret deleted',
  });
}));

export default secrets;
