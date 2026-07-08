/**
 * Secret management layer
 * Handles encrypted storage and retrieval of integration API keys
 * All secrets encrypted at rest using AES-256-GCM
 */

import {
  encryptSecret,
  decryptSecret,
  hashKeyForSearch,
  getMasterKey,
  getKeyPrefix,
  validateDecryptedKey,
} from './encryption';
import type { IntegrationSecret, IntegrationSecretRequest, IntegrationSecretResponse, KeyType, Env } from '../types';

/**
 * Store a new secret in the database with encryption
 */
export async function storeSecret(
  env: Env,
  req: IntegrationSecretRequest,
  createdBy: string
): Promise<IntegrationSecretResponse> {
  const masterKey = await getMasterKey(env);

  const secretId = `secret_${crypto.randomUUID()}`;
  const keyPrefix = getKeyPrefix(req.value);
  const keyHash = await hashKeyForSearch(keyPrefix, req.value);
  const encrypted = await encryptSecret(req.value, masterKey);

  const metadataJson = req.metadata ? JSON.stringify(req.metadata) : null;

  try {
    const stmt = env.PLATFORM_DB.prepare(`
      INSERT INTO integration_secrets
      (id, integration_id, key_type, key_prefix, key_hash, encrypted_value, created_by, metadata_json, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      secretId,
      req.integration_id,
      req.key_type,
      keyPrefix,
      keyHash,
      encrypted,
      createdBy,
      metadataJson,
      req.expires_at || null
    ).run();

    return {
      id: secretId,
      integration_id: req.integration_id,
      key_type: req.key_type,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      created_at: new Date().toISOString(),
      created_by: createdBy,
      rotation_count: 0,
      metadata: req.metadata,
    };
  } catch (error) {
    console.error('Failed to store secret:', error);
    throw new Error('Failed to store secret in database');
  }
}

/**
 * Retrieve a secret by ID (decrypts the value)
 * WARNING: Only call this in secure contexts (server-side routes with permission checks)
 */
export async function getSecretValue(
  env: Env,
  secretId: string
): Promise<string> {
  const masterKey = await getMasterKey(env);

  try {
    const stmt = env.PLATFORM_DB.prepare(`
      SELECT encrypted_value FROM integration_secrets WHERE id = ?
    `);

    const result = await stmt.bind(secretId).first<{ encrypted_value: string }>();

    if (!result) {
      throw new Error('Secret not found');
    }

    return await decryptSecret(result.encrypted_value, masterKey);
  } catch (error) {
    console.error('Failed to retrieve secret value:', error);
    throw new Error('Failed to retrieve secret');
  }
}

/**
 * Get secret metadata (prefix, hash, dates) WITHOUT decrypting
 * Safe to return to authenticated API responses
 */
export async function getSecretMetadata(
  env: Env,
  secretId: string
): Promise<IntegrationSecretResponse | null> {
  try {
    const stmt = env.PLATFORM_DB.prepare(`
      SELECT
        id, integration_id, key_type, key_prefix, key_hash,
        created_at, rotated_at, expires_at, created_by, rotation_count,
        metadata_json
      FROM integration_secrets
      WHERE id = ?
    `);

    const row = await stmt.bind(secretId).first<any>();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      integration_id: row.integration_id,
      key_type: row.key_type,
      key_prefix: row.key_prefix,
      key_hash: row.key_hash,
      created_at: row.created_at,
      rotated_at: row.rotated_at,
      expires_at: row.expires_at,
      created_by: row.created_by,
      rotation_count: row.rotation_count,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    };
  } catch (error) {
    console.error('Failed to retrieve secret metadata:', error);
    throw new Error('Failed to retrieve secret metadata');
  }
}

/**
 * List all secrets for an integration (metadata only, no decryption)
 */
export async function listSecrets(
  env: Env,
  integrationId: string,
  keyType?: KeyType
): Promise<IntegrationSecretResponse[]> {
  try {
    let query = `
      SELECT
        id, integration_id, key_type, key_prefix, key_hash,
        created_at, rotated_at, expires_at, created_by, rotation_count,
        metadata_json
      FROM integration_secrets
      WHERE integration_id = ?
    `;

    const params: any[] = [integrationId];

    if (keyType) {
      query += ' AND key_type = ?';
      params.push(keyType);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = env.PLATFORM_DB.prepare(query);
    const rows = await stmt.bind(...params).all<any>();

    return (rows.results || []).map((row) => ({
      id: row.id,
      integration_id: row.integration_id,
      key_type: row.key_type,
      key_prefix: row.key_prefix,
      key_hash: row.key_hash,
      created_at: row.created_at,
      rotated_at: row.rotated_at,
      expires_at: row.expires_at,
      created_by: row.created_by,
      rotation_count: row.rotation_count,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    }));
  } catch (error) {
    console.error('Failed to list secrets:', error);
    throw new Error('Failed to list secrets');
  }
}

/**
 * Rotate a secret (replace with new value, increment rotation count)
 */
export async function rotateSecret(
  env: Env,
  secretId: string,
  newValue: string,
  updatedBy: string
): Promise<IntegrationSecretResponse> {
  const masterKey = await getMasterKey(env);

  const keyPrefix = getKeyPrefix(newValue);
  const keyHash = await hashKeyForSearch(keyPrefix, newValue);
  const encrypted = await encryptSecret(newValue, masterKey);
  const now = new Date().toISOString();

  try {
    const stmt = env.PLATFORM_DB.prepare(`
      UPDATE integration_secrets
      SET
        key_prefix = ?,
        key_hash = ?,
        encrypted_value = ?,
        rotated_at = ?,
        rotation_count = rotation_count + 1
      WHERE id = ?
    `);

    await stmt.bind(keyPrefix, keyHash, encrypted, now, secretId).run();

    return await getSecretMetadata(env, secretId) as IntegrationSecretResponse;
  } catch (error) {
    console.error('Failed to rotate secret:', error);
    throw new Error('Failed to rotate secret');
  }
}

/**
 * Revoke a secret (soft delete - mark as revoked)
 */
export async function revokeSecret(
  env: Env,
  secretId: string,
  revokedBy: string
): Promise<void> {
  try {
    // Update integration status if this was the last active secret
    const metadata = await getSecretMetadata(env, secretId);

    if (metadata) {
      // Could add logic here to check if integration has other active secrets
      // and update integration.secrets_status accordingly
    }

    // Secrets are retained in DB for audit trail (soft delete via tombstone)
    // In a future enhancement, could add 'revoked_at' column and soft-delete logic
  } catch (error) {
    console.error('Failed to revoke secret:', error);
    throw new Error('Failed to revoke secret');
  }
}

/**
 * Extend expiration date of a secret (for OAuth tokens, etc)
 */
export async function extendSecretExpiry(
  env: Env,
  secretId: string,
  newExpiresAt: string,
  updatedBy: string
): Promise<IntegrationSecretResponse> {
  try {
    const stmt = env.PLATFORM_DB.prepare(`
      UPDATE integration_secrets
      SET expires_at = ?
      WHERE id = ?
    `);

    await stmt.bind(newExpiresAt, secretId).run();

    return await getSecretMetadata(env, secretId) as IntegrationSecretResponse;
  } catch (error) {
    console.error('Failed to extend secret expiry:', error);
    throw new Error('Failed to extend secret expiry');
  }
}

/**
 * Find secrets expiring soon (used by token rotation job)
 */
export async function findExpiringSecrets(
  env: Env,
  daysUntilExpiry: number = 7
): Promise<IntegrationSecretResponse[]> {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysUntilExpiry);

    const stmt = env.PLATFORM_DB.prepare(`
      SELECT
        id, integration_id, key_type, key_prefix, key_hash,
        created_at, rotated_at, expires_at, created_by, rotation_count,
        metadata_json
      FROM integration_secrets
      WHERE expires_at IS NOT NULL
        AND expires_at <= ?
        AND key_type = 'oauth_token'
      ORDER BY expires_at ASC
    `);

    const rows = await stmt.bind(futureDate.toISOString()).all<any>();

    return (rows.results || []).map((row) => ({
      id: row.id,
      integration_id: row.integration_id,
      key_type: row.key_type,
      key_prefix: row.key_prefix,
      key_hash: row.key_hash,
      created_at: row.created_at,
      rotated_at: row.rotated_at,
      expires_at: row.expires_at,
      created_by: row.created_by,
      rotation_count: row.rotation_count,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    }));
  } catch (error) {
    console.error('Failed to find expiring secrets:', error);
    throw new Error('Failed to find expiring secrets');
  }
}

/**
 * Migrate plaintext config to encrypted secret storage
 * Used during transition from old KV-only credential storage
 */
export async function migrateSecretFromConfig(
  env: Env,
  integrationId: string,
  keyType: KeyType,
  plaintextValue: string,
  createdBy: string = 'migration'
): Promise<IntegrationSecretResponse> {
  const req: IntegrationSecretRequest = {
    integration_id: integrationId,
    key_type: keyType,
    value: plaintextValue,
    metadata: { migrated: true, migratedAt: new Date().toISOString() },
  };

  return storeSecret(env, req, createdBy);
}
