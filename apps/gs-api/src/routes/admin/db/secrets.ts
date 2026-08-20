/**
 * Secrets management database queries
 * Handles encrypted integration credentials (Stripe, Meta, OpenAI, Google, Cloudflare)
 */

export async function getSecrets(
  db: any,
  options: {
    offset: number;
    limit: number;
    integration_id?: string;
    include_expired?: boolean;
  }
) {
  try {
    const where: string[] = [];
    const params: any[] = [];

    if (options.integration_id) {
      where.push('integration_id = ?');
      params.push(options.integration_id);
    }

    if (!options.include_expired) {
      where.push('(expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)');
    }

    let query = 'SELECT id, integration_id, key_type, key_prefix, created_at, rotated_at, expires_at, rotation_count FROM admin_secrets';
    let countQuery = 'SELECT COUNT(*) as total FROM admin_secrets';

    if (where.length) {
      const whereClause = where.join(' AND ');
      query += ' WHERE ' + whereClause;
      countQuery += ' WHERE ' + whereClause;
    }

    const total = await db.prepare(countQuery).bind(...params).first();
    const secrets = await db.prepare(
      query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, options.limit, options.offset).all();

    const pages = Math.ceil((total?.total || 0) / options.limit);
    return {
      items: secrets.results || [],
      pagination: {
        page: Math.floor(options.offset / options.limit) + 1,
        pages,
        total: total?.total || 0,
      },
    };
  } catch (err) {
    throw new Error(`Failed to get secrets: ${err}`);
  }
}

export async function getSecretById(db: any, id: string) {
  try {
    return await db.prepare(
      'SELECT id, integration_id, key_type, key_prefix, created_at, rotated_at, expires_at, rotation_count, is_active FROM admin_secrets WHERE id = ?'
    ).bind(id).first();
  } catch (err) {
    throw new Error(`Failed to get secret: ${err}`);
  }
}

export async function createSecret(
  db: any,
  data: {
    integration_id: string;
    key_type: string;
    key_prefix: string;
    encryptedValue: string;
    expiresAt?: string;
    createdBy?: string;
  }
) {
  try {
    const id = crypto.randomUUID();
    return await db.prepare(
      `INSERT INTO admin_secrets (id, integration_id, key_type, key_prefix, encrypted_value, expires_at, rotation_count, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      data.integration_id,
      data.key_type,
      data.key_prefix,
      data.encryptedValue,
      data.expiresAt || null,
      0,
      data.createdBy || 'system',
      data.createdBy || 'system'
    ).run();
  } catch (err) {
    throw new Error(`Failed to create secret: ${err}`);
  }
}

export async function rotateSecret(
  db: any,
  id: string,
  encryptedValue: string,
  keyPrefix: string,
  updatedBy?: string
) {
  try {
    return await db.prepare(
      `UPDATE admin_secrets
       SET encrypted_value = ?, key_prefix = ?, rotated_at = CURRENT_TIMESTAMP, rotation_count = rotation_count + 1, updated_by = ?
       WHERE id = ?`
    ).bind(encryptedValue, keyPrefix, updatedBy || 'system', id).run();
  } catch (err) {
    throw new Error(`Failed to rotate secret: ${err}`);
  }
}

export async function deleteSecret(db: any, id: string) {
  try {
    return await db.prepare(
      'DELETE FROM admin_secrets WHERE id = ?'
    ).bind(id).run();
  } catch (err) {
    throw new Error(`Failed to delete secret: ${err}`);
  }
}
