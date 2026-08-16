/**
 * Secrets management database queries
 * Handles encrypted integration credentials (Stripe, Meta, OpenAI, Google, Cloudflare)
 */

export async function getSecrets(
  db: any,
  options: {
    offset: number;
    limit: number;
    integration?: string;
    isActive?: boolean;
  }
) {
  try {
    const where: string[] = [];
    const params: any[] = [];

    if (options.integration) {
      where.push('integration = ?');
      params.push(options.integration);
    }

    if (options.isActive !== undefined) {
      where.push('is_active = ?');
      params.push(options.isActive ? 1 : 0);
    }

    let query = 'SELECT id, name, integration, type, is_active, created_at, updated_at, created_by, updated_by FROM admin_secrets';
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

    return {
      items: secrets.results || [],
      total: total?.total || 0,
      offset: options.offset,
      limit: options.limit,
      page: Math.floor(options.offset / options.limit) + 1,
    };
  } catch (err) {
    throw new Error(`Failed to get secrets: ${err}`);
  }
}

export async function getSecretById(db: any, id: string) {
  try {
    return await db.prepare(
      'SELECT id, name, integration, type, is_active, created_at, updated_at, created_by, updated_by FROM admin_secrets WHERE id = ?'
    ).bind(id).first();
  } catch (err) {
    throw new Error(`Failed to get secret: ${err}`);
  }
}

export async function getSecretByName(db: any, name: string) {
  try {
    return await db.prepare(
      'SELECT id, name, integration, type, is_active, created_at, updated_at, created_by, updated_by FROM admin_secrets WHERE name = ?'
    ).bind(name).first();
  } catch (err) {
    throw new Error(`Failed to get secret: ${err}`);
  }
}

export async function createSecret(
  db: any,
  data: {
    name: string;
    integration: string;
    encryptedValue: string;
    type?: string;
    createdBy?: string;
  }
) {
  try {
    const id = crypto.randomUUID();
    return await db.prepare(
      `INSERT INTO admin_secrets (id, name, integration, encrypted_value, type, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      data.name,
      data.integration,
      data.encryptedValue,
      data.type || 'api_key',
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
  updatedBy?: string
) {
  try {
    return await db.prepare(
      `UPDATE admin_secrets
       SET encrypted_value = ?, last_rotated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, updated_by = ?
       WHERE id = ?`
    ).bind(encryptedValue, updatedBy || 'system', id).run();
  } catch (err) {
    throw new Error(`Failed to rotate secret: ${err}`);
  }
}

export async function revokeSecret(db: any, id: string, updatedBy?: string) {
  try {
    return await db.prepare(
      `UPDATE admin_secrets
       SET is_active = 0, updated_at = CURRENT_TIMESTAMP, updated_by = ?
       WHERE id = ?`
    ).bind(updatedBy || 'system', id).run();
  } catch (err) {
    throw new Error(`Failed to revoke secret: ${err}`);
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
