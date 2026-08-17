import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { verifyAdminAuth, errorHandler } from './middleware/auth';
import * as settingsDb from './db/settings';

const settings = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply auth middleware
settings.use('*', verifyAdminAuth);

/**
 * GET /api/admin/settings
 * Get all settings
 */
settings.get('/', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const allSettings = await settingsDb.getAllSettings(db);
  return c.json({ settings: allSettings });
}));

/**
 * GET /api/admin/settings/:key
 * Get single setting
 */
settings.get('/:key', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const key = c.req.param('key');

  const value = await settingsDb.getSetting(db, key);
  if (value === null) {
    return c.json({ error: 'Setting not found' }, 404);
  }

  return c.json({ key, value });
}));

/**
 * POST /api/admin/settings/:key
 * Set single setting
 */
settings.post('/:key', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const key = c.req.param('key');
  const currentUser = c.get('user');
  const body = await c.req.json();

  if (body.value === undefined) {
    return c.json({ error: 'Value is required' }, 400);
  }

  await settingsDb.setSetting(db, key, body.value, {
    type: body.type,
    description: body.description,
    updatedBy: currentUser.email,
  });

  console.log(`[AUDIT] ${currentUser.email} updated setting: ${key}`);

  return c.json({
    success: true,
    message: 'Setting updated',
    key,
    value: body.value,
  });
}));

/**
 * POST /api/admin/settings
 * Batch update settings
 */
settings.post('/', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const currentUser = c.get('user');
  const body = await c.req.json();

  if (!body.settings || typeof body.settings !== 'object') {
    return c.json({ error: 'Settings object is required' }, 400);
  }

  await settingsDb.updateSettings(db, body.settings, currentUser.email);

  console.log(`[AUDIT] ${currentUser.email} batch updated settings`);

  return c.json({
    success: true,
    message: `${Object.keys(body.settings).length} settings updated`,
  });
}));

/**
 * DELETE /api/admin/settings/:key
 * Delete setting
 */
settings.delete('/:key', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const key = c.req.param('key');
  const currentUser = c.get('user');

  await settingsDb.deleteSetting(db, key);

  console.log(`[AUDIT] ${currentUser.email} deleted setting: ${key}`);

  return c.json({ success: true, message: 'Setting deleted' });
}));

export default settings;
