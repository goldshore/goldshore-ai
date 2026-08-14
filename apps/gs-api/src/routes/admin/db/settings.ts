/**
 * Settings database queries
 * Handles global configuration key-value pairs
 */

export async function getAllSettings(db: any) {
  try {
    const result = await db.prepare(
      'SELECT key, value, type, description FROM admin_settings'
    ).all();

    // Convert to object
    const settings: Record<string, any> = {};
    for (const row of result.results || []) {
      try {
        settings[row.key] = row.type === 'json' ? JSON.parse(row.value) : row.value;
      } catch {
        settings[row.key] = row.value;
      }
    }

    return settings;
  } catch (err) {
    throw new Error(`Failed to get settings: ${err}`);
  }
}

export async function getSetting(db: any, key: string) {
  try {
    const result = await db.prepare(
      'SELECT key, value, type FROM admin_settings WHERE key = ?'
    ).bind(key).first();

    if (!result) {
      return null;
    }

    try {
      return result.type === 'json' ? JSON.parse(result.value) : result.value;
    } catch {
      return result.value;
    }
  } catch (err) {
    throw new Error(`Failed to get setting: ${err}`);
  }
}

export async function setSetting(
  db: any,
  key: string,
  value: any,
  options?: {
    type?: 'string' | 'json' | 'number' | 'boolean';
    description?: string;
    updatedBy?: string;
  }
) {
  try {
    const type = options?.type || (typeof value === 'string' ? 'string' : 'json');
    const stringValue = type === 'json' ? JSON.stringify(value) : String(value);

    // Upsert: insert or update
    const existing = await db.prepare(
      'SELECT key FROM admin_settings WHERE key = ?'
    ).bind(key).first();

    if (existing) {
      return await db.prepare(
        'UPDATE admin_settings SET value = ?, type = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
      ).bind(stringValue, type, options?.updatedBy || 'system', key).run();
    } else {
      return await db.prepare(
        'INSERT INTO admin_settings (key, value, type, description, updated_by) VALUES (?, ?, ?, ?, ?)'
      ).bind(key, stringValue, type, options?.description || null, options?.updatedBy || 'system').run();
    }
  } catch (err) {
    throw new Error(`Failed to set setting: ${err}`);
  }
}

export async function deleteSetting(db: any, key: string) {
  try {
    return await db.prepare(
      'DELETE FROM admin_settings WHERE key = ?'
    ).bind(key).run();
  } catch (err) {
    throw new Error(`Failed to delete setting: ${err}`);
  }
}

export async function updateSettings(
  db: any,
  updates: Record<string, any>,
  updatedBy?: string
) {
  try {
    const results = [];
    for (const [key, value] of Object.entries(updates)) {
      results.push(
        await setSetting(db, key, value, { updatedBy })
      );
    }
    return results;
  } catch (err) {
    throw new Error(`Failed to update settings: ${err}`);
  }
}
