/**
 * Entries management database queries
 * Handles contact form submissions and lead data
 */

export async function getEntries(
  db: any,
  options: {
    offset: number;
    limit: number;
    type?: 'contacts' | 'leads';
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  try {
    const whereConditions: string[] = [];
    const params: any[] = [];

    if (options.type === 'contacts') {
      whereConditions.push("'contacts' = 'contacts'"); // Placeholder for table selection
    } else if (options.type === 'leads') {
      whereConditions.push("'leads' = 'leads'");
    }

    if (options.status) {
      whereConditions.push('status = ?');
      params.push(options.status);
    }

    if (options.dateFrom) {
      whereConditions.push('created_at >= ?');
      params.push(options.dateFrom);
    }

    if (options.dateTo) {
      whereConditions.push('created_at <= ?');
      params.push(options.dateTo);
    }

    // TODO: Implement unified entries query across contacts and leads tables
    let query = 'SELECT * FROM admin_contact_submissions';
    let countQuery = 'SELECT COUNT(*) as total FROM admin_contact_submissions';

    if (whereConditions.length > 0) {
      const whereClause = whereConditions.join(' AND ').replace("'contacts' = 'contacts'", '').replace("'leads' = 'leads'", '');
      if (whereClause.trim()) {
        query += ' WHERE ' + whereClause;
        countQuery += ' WHERE ' + whereClause;
      }
    }

    const total = await db.prepare(countQuery).bind(...params).first();
    const entries = await db.prepare(
      query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, options.limit, options.offset).all();

    return {
      items: entries.results || [],
      total: total?.total || 0,
      offset: options.offset,
      limit: options.limit,
      page: Math.floor(options.offset / options.limit) + 1,
    };
  } catch (err) {
    throw new Error(`Failed to get entries: ${err}`);
  }
}

export async function getContacts(
  db: any,
  options: {
    offset: number;
    limit: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  return getEntries(db, { ...options, type: 'contacts' });
}

export async function getLeads(
  db: any,
  options: {
    offset: number;
    limit: number;
    status?: string;
    source?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  try {
    const whereConditions: string[] = [];
    const params: any[] = [];

    if (options.status) {
      whereConditions.push('status = ?');
      params.push(options.status);
    }

    if (options.source) {
      whereConditions.push('source = ?');
      params.push(options.source);
    }

    if (options.dateFrom) {
      whereConditions.push('created_at >= ?');
      params.push(options.dateFrom);
    }

    if (options.dateTo) {
      whereConditions.push('created_at <= ?');
      params.push(options.dateTo);
    }

    let query = 'SELECT * FROM admin_leads';
    let countQuery = 'SELECT COUNT(*) as total FROM admin_leads';

    if (whereConditions.length > 0) {
      const whereClause = whereConditions.join(' AND ');
      query += ' WHERE ' + whereClause;
      countQuery += ' WHERE ' + whereClause;
    }

    const total = await db.prepare(countQuery).bind(...params).first();
    const leads = await db.prepare(
      query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, options.limit, options.offset).all();

    return {
      items: leads.results || [],
      total: total?.total || 0,
      offset: options.offset,
      limit: options.limit,
      page: Math.floor(options.offset / options.limit) + 1,
    };
  } catch (err) {
    throw new Error(`Failed to get leads: ${err}`);
  }
}

export async function getEntryById(db: any, id: string, type?: 'contacts' | 'leads') {
  try {
    const table = type === 'leads' ? 'admin_leads' : 'admin_contact_submissions';
    return await db.prepare(
      `SELECT * FROM ${table} WHERE id = ?`
    ).bind(id).first();
  } catch (err) {
    throw new Error(`Failed to get entry: ${err}`);
  }
}

export async function updateContactStatus(
  db: any,
  id: string,
  status: string,
  notes?: string
) {
  try {
    const fields: string[] = ['status = ?'];
    const params: any[] = [status];

    if (notes) {
      fields.push('notes = ?');
      params.push(notes);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    return await db.prepare(
      `UPDATE admin_contact_submissions SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...params).run();
  } catch (err) {
    throw new Error(`Failed to update contact: ${err}`);
  }
}

export async function updateLeadStatus(
  db: any,
  id: string,
  status: string,
  assignedTo?: string
) {
  try {
    const fields: string[] = ['status = ?'];
    const params: any[] = [status];

    if (assignedTo) {
      fields.push('assigned_to = ?');
      params.push(assignedTo);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    return await db.prepare(
      `UPDATE admin_leads SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...params).run();
  } catch (err) {
    throw new Error(`Failed to update lead: ${err}`);
  }
}

export async function createContact(
  db: any,
  data: {
    name: string;
    email: string;
    phone?: string;
    message: string;
    source?: string;
  }
) {
  try {
    const id = crypto.randomUUID();
    return await db.prepare(
      'INSERT INTO admin_contact_submissions (id, name, email, phone, message, source) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, data.name, data.email, data.phone || null, data.message, data.source || 'website').run();
  } catch (err) {
    throw new Error(`Failed to create contact: ${err}`);
  }
}

export async function createLead(
  db: any,
  data: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    source?: string;
    metadata?: Record<string, any>;
  }
) {
  try {
    const id = crypto.randomUUID();
    return await db.prepare(
      'INSERT INTO admin_leads (id, name, email, phone, company, source, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      data.name,
      data.email,
      data.phone || null,
      data.company || null,
      data.source || 'manual',
      data.metadata ? JSON.stringify(data.metadata) : null
    ).run();
  } catch (err) {
    throw new Error(`Failed to create lead: ${err}`);
  }
}

export async function deleteEntry(db: any, id: string, type?: 'contacts' | 'leads') {
  try {
    const table = type === 'leads' ? 'admin_leads' : 'admin_contact_submissions';
    return await db.prepare(
      `DELETE FROM ${table} WHERE id = ?`
    ).bind(id).run();
  } catch (err) {
    throw new Error(`Failed to delete entry: ${err}`);
  }
}

export async function bulkUpdateLeadStatus(
  db: any,
  ids: string[],
  status: string,
  metadata?: Record<string, any>
) {
  try {
    if (ids.length === 0) return { success: true, updated: 0 };

    const placeholders = ids.map(() => '?').join(',');
    const fields: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [status, ...ids];

    if (metadata?.assignedTo) {
      fields.push('assigned_to = ?');
      params.unshift(metadata.assignedTo);
    }

    if (metadata?.qualificationReason && status === 'qualified') {
      fields.push('metadata = json_set(COALESCE(metadata, "{}"), "$.qualification_reason", ?)');
      params.unshift(metadata.qualificationReason);
    }

    const query = `UPDATE admin_leads SET ${fields.join(', ')} WHERE id IN (${placeholders})`;
    const result = await db.prepare(query).bind(...params).run();

    return { success: true, updated: result.meta.duration };
  } catch (err) {
    throw new Error(`Failed to bulk update leads: ${err}`);
  }
}

export async function bulkDeleteEntries(db: any, ids: string[], type?: 'contacts' | 'leads') {
  try {
    if (ids.length === 0) return { success: true, deleted: 0 };

    const table = type === 'leads' ? 'admin_leads' : 'admin_contact_submissions';
    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM ${table} WHERE id IN (${placeholders})`;

    const result = await db.prepare(query).bind(...ids).run();
    return { success: true, deleted: ids.length };
  } catch (err) {
    throw new Error(`Failed to bulk delete entries: ${err}`);
  }
}

export async function qualifyLead(
  db: any,
  id: string,
  reason: string,
  qualifiedBy: string
) {
  try {
    return await db.prepare(
      `UPDATE admin_leads
       SET status = 'qualified',
           metadata = json_set(COALESCE(metadata, "{}"), "$.qualification_reason", ?),
           metadata = json_set(metadata, "$.qualified_by", ?),
           metadata = json_set(metadata, "$.qualified_at", datetime('now')),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(reason, qualifiedBy, id).run();
  } catch (err) {
    throw new Error(`Failed to qualify lead: ${err}`);
  }
}

export async function getLeadsByStatus(
  db: any,
  status: 'new' | 'qualified' | 'rejected' | 'contacted',
  options?: {
    offset?: number;
    limit?: number;
  }
) {
  try {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    const query = 'SELECT * FROM admin_leads WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const countQuery = 'SELECT COUNT(*) as total FROM admin_leads WHERE status = ?';

    const total = await db.prepare(countQuery).bind(status).first();
    const leads = await db.prepare(query).bind(status, limit, offset).all();

    return {
      items: leads.results || [],
      total: total?.total || 0,
      offset,
      limit,
      page: Math.floor(offset / limit) + 1,
    };
  } catch (err) {
    throw new Error(`Failed to get leads by status: ${err}`);
  }
}
