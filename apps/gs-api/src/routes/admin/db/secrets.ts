/**
 * Secrets management database queries
 * Handles encrypted integration credentials (Stripe, Meta, OpenAI, Google, Cloudflare)
 *
 * Reads query integration_secrets directly (metadata columns only - key_prefix and
 * key_hash are safe to return, encrypted_value never is). Writes delegate to
 * lib/secrets.ts, the tested AES-256-GCM layer (lib/encryption.ts) already backing
 * integration-keys.ts, oauth.ts, ad-integrations.ts, and the token-rotation worker.
 *
 * This file previously queried a table (admin_secrets) that was never created with
 * a matching schema - every call 500'd with "no such column" - and the route layer
 * "encrypted" new values with `Buffer.from(value).toString('base64')`, which is
 * reversible text encoding, not encryption. Both are fixed by using the real
 * integration_secrets table and the real encryption module instead.
 */
import {
  storeSecret,
  rotateSecret as rotateSecretValue,
  revokeSecret,
} from '../../../lib/secrets';
import type { Env, KeyType } from '../../../types';

export async function getSecrets(
  db: any,
  options: {
    offset: number;
    limit: number;
    integration_id?: string;
    include_expired?: boolean;
  }
) {
  const where: string[] = [];
  const params: unknown[] = [];

  if (options.integration_id) {
    where.push('integration_id = ?');
    params.push(options.integration_id);
  }
  if (!options.include_expired) {
    where.push('(expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)');
  }

  let query =
    'SELECT id, integration_id, key_type, key_prefix, created_at, rotated_at, expires_at, rotation_count FROM integration_secrets';
  let countQuery = 'SELECT COUNT(*) as total FROM integration_secrets';
  if (where.length) {
    const whereClause = where.join(' AND ');
    query += ' WHERE ' + whereClause;
    countQuery += ' WHERE ' + whereClause;
  }

  const total = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
  const secrets = await db
    .prepare(query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(...params, options.limit, options.offset)
    .all();

  const pages = Math.ceil((total?.total || 0) / options.limit);
  return {
    items: secrets.results || [],
    pagination: {
      page: Math.floor(options.offset / options.limit) + 1,
      pages,
      total: total?.total || 0,
    },
  };
}

export async function getSecretById(db: any, id: string) {
  return db
    .prepare(
      'SELECT id, integration_id, key_type, key_prefix, created_at, rotated_at, expires_at, rotation_count FROM integration_secrets WHERE id = ?'
    )
    .bind(id)
    .first();
}

export async function createSecret(
  env: Env,
  data: {
    integration_id: string;
    key_type: KeyType;
    value: string;
    expires_at?: string;
    createdBy: string;
  }
) {
  return storeSecret(
    env,
    {
      integration_id: data.integration_id,
      key_type: data.key_type,
      value: data.value,
      expires_at: data.expires_at,
    },
    data.createdBy
  );
}

export async function rotateSecret(env: Env, id: string, newValue: string, updatedBy: string) {
  return rotateSecretValue(env, id, newValue, updatedBy);
}

export async function deleteSecret(env: Env, id: string, revokedBy: string) {
  return revokeSecret(env, id, revokedBy);
}
