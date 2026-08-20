import { Hono } from 'hono';
import { getActor, logAdminAction, requirePermission } from '../auth';
import type { Env, Variables, IntegrationSecretRequest, IntegrationSecretResponse, KeyType } from '../types';
import { storeSecret, getSecretMetadata, rotateSecret, revokeSecret, extendSecretExpiry } from '../lib/secrets';

const integrationKeys = new Hono<{ Bindings: Env; Variables: Variables }>();
const keyTypes = new Set<KeyType>(['apiKey', 'apiSecret', 'webhook_secret', 'oauth_token']);
const integrationIdPattern = /^[a-z0-9][a-z0-9_-]{1,63}$/i;

const publicMetadata = (secret: IntegrationSecretResponse) => ({
  id: secret.id,
  integration_id: secret.integration_id,
  key_type: secret.key_type,
  key_prefix: secret.key_prefix,
  created_at: secret.created_at,
  rotated_at: secret.rotated_at ?? null,
  expires_at: secret.expires_at ?? null,
  created_by: secret.created_by,
  rotation_count: secret.rotation_count,
  metadata: secret.metadata,
});

const parseExpiry = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const audit = (c: any, action: string, status: 'success' | 'error', metadata: Record<string, unknown>) =>
  logAdminAction(c.env, { action, actor: getActor(c.get('accessClaims'), c.req.raw), status, metadata });

integrationKeys.get('/', requirePermission('secret_metadata:read'), async (c) => {
  const integrationId = c.req.query('integration_id')?.trim();
  const keyType = c.req.query('key_type') as KeyType | undefined;
  const includeExpired = c.req.query('include_expired') === 'true';
  const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(c.req.query('pageSize') ?? '25', 10) || 25));
  if (integrationId && !integrationIdPattern.test(integrationId)) return c.json({ error: 'Invalid integration_id.' }, 400);
  if (keyType && !keyTypes.has(keyType)) return c.json({ error: 'Invalid key_type.' }, 400);

  const where: string[] = [];
  const values: unknown[] = [];
  if (integrationId) { where.push('integration_id = ?'); values.push(integrationId); }
  if (keyType) { where.push('key_type = ?'); values.push(keyType); }
  if (!includeExpired) where.push("(expires_at IS NULL OR expires_at > datetime('now'))");
  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const fields = 'id,integration_id,key_type,key_prefix,created_at,rotated_at,expires_at,created_by,rotation_count,metadata_json';
  const rows = await c.env.PLATFORM_DB.prepare(`SELECT ${fields} FROM integration_secrets ${filter} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...values, pageSize, (page - 1) * pageSize).all<any>();
  const count = await c.env.PLATFORM_DB.prepare(`SELECT COUNT(*) total FROM integration_secrets ${filter}`)
    .bind(...values).first<{ total: number }>();
  const items = rows.results.map((row) => ({
    ...row,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    metadata_json: undefined,
  }));
  const total = Number(count?.total ?? 0);
  await audit(c, 'secret.list', 'success', { count: items.length, integrationId: integrationId ?? null });
  return c.json({ success: true, items, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
});

integrationKeys.get('/:secretId', requirePermission('secret_metadata:read'), async (c) => {
  const secret = await getSecretMetadata(c.env, c.req.param('secretId'));
  return secret ? c.json({ success: true, data: publicMetadata(secret) }) : c.json({ error: 'Secret not found.' }, 404);
});

integrationKeys.post('/', requirePermission('secret_metadata:rotate'), async (c) => {
  const body = await c.req.json<IntegrationSecretRequest>().catch(() => null);
  if (!body || !integrationIdPattern.test(body.integration_id ?? '') || !keyTypes.has(body.key_type) || typeof body.value !== 'string') {
    return c.json({ error: 'A valid integration, key type, and value are required.' }, 400);
  }
  const value = body.value.trim();
  if (value.length < 8 || value.length > 16_384) return c.json({ error: 'Secret values must be between 8 and 16384 characters.' }, 400);
  const expiresAt = parseExpiry(body.expires_at);
  if (body.expires_at && !expiresAt) return c.json({ error: 'Invalid expiration date.' }, 400);
  try {
    const result = await storeSecret(c.env, { ...body, value, expires_at: expiresAt ?? undefined }, getActor(c.get('accessClaims'), c.req.raw));
    await audit(c, 'secret.create', 'success', { secretId: result.id, integrationId: body.integration_id, keyType: body.key_type });
    return c.json({ success: true, data: publicMetadata(result) }, 201);
  } catch {
    await audit(c, 'secret.create', 'error', { integrationId: body.integration_id, keyType: body.key_type });
    return c.json({ error: 'The secret could not be stored. Check whether that integration and key type already exist.' }, 409);
  }
});

integrationKeys.patch('/:secretId', requirePermission('secret_metadata:rotate'), async (c) => {
  const secretId = c.req.param('secretId');
  const existing = await getSecretMetadata(c.env, secretId);
  if (!existing) return c.json({ error: 'Secret not found.' }, 404);
  const body = await c.req.json<{ action?: 'rotate' | 'extend'; new_value?: string; expires_at?: string }>().catch(() => null);
  if (!body?.action || !['rotate', 'extend'].includes(body.action)) return c.json({ error: 'Action must be rotate or extend.' }, 400);
  const actor = getActor(c.get('accessClaims'), c.req.raw);
  if (body.action === 'rotate') {
    const value = body.new_value?.trim() ?? '';
    if (value.length < 8 || value.length > 16_384) return c.json({ error: 'New secret values must be between 8 and 16384 characters.' }, 400);
    const result = await rotateSecret(c.env, secretId, value, actor);
    await audit(c, 'secret.rotate', 'success', { secretId, integrationId: existing.integration_id });
    return c.json({ success: true, data: publicMetadata(result) });
  }
  const expiresAt = parseExpiry(body.expires_at);
  if (!expiresAt) return c.json({ error: 'A valid expiration date is required.' }, 400);
  const result = await extendSecretExpiry(c.env, secretId, expiresAt, actor);
  await audit(c, 'secret.extend', 'success', { secretId, expiresAt });
  return c.json({ success: true, data: publicMetadata(result) });
});

integrationKeys.delete('/:secretId', requirePermission('secret_metadata:rotate'), async (c) => {
  const secretId = c.req.param('secretId');
  const existing = await getSecretMetadata(c.env, secretId);
  if (!existing) return c.json({ error: 'Secret not found.' }, 404);
  await revokeSecret(c.env, secretId, getActor(c.get('accessClaims'), c.req.raw));
  await audit(c, 'secret.revoke', 'success', { secretId, integrationId: existing.integration_id });
  return c.body(null, 204);
});

integrationKeys.post('/:secretId/verify', requirePermission('secret_metadata:rotate'), async (c) => {
  const secret = await getSecretMetadata(c.env, c.req.param('secretId'));
  if (!secret) return c.json({ error: 'Secret not found.' }, 404);
  return c.json({
    success: true,
    data: { valid: null, status: 'unsupported', message: 'Provider-specific verification is not configured for this credential.' },
  }, 501);
});

export default integrationKeys;
