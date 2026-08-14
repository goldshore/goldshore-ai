/**
 * Email management database queries
 * Handles email queue status, logs, and operations
 */

export async function getEmailQueueStatus(db: any) {
  try {
    const [queued, sent, failed] = await Promise.all([
      db.prepare(
        'SELECT COUNT(*) as count FROM admin_emails WHERE status = ?'
      ).bind('queued').first(),
      db.prepare(
        'SELECT COUNT(*) as count FROM admin_emails WHERE status = ?'
      ).bind('sent').first(),
      db.prepare(
        'SELECT COUNT(*) as count FROM admin_emails WHERE status = ?'
      ).bind('failed').first(),
    ]);

    return {
      queued: queued?.count || 0,
      sent: sent?.count || 0,
      failed: failed?.count || 0,
      total: (queued?.count || 0) + (sent?.count || 0) + (failed?.count || 0),
    };
  } catch (err) {
    throw new Error(`Failed to get email queue status: ${err}`);
  }
}

export async function getEmailLogs(
  db: any,
  options: {
    offset: number;
    limit: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  try {
    let query = 'SELECT * FROM admin_emails';
    const params: any[] = [];

    const where: string[] = [];
    if (options.status) {
      where.push('status = ?');
      params.push(options.status);
    }
    if (options.dateFrom) {
      where.push('created_at >= ?');
      params.push(options.dateFrom);
    }
    if (options.dateTo) {
      where.push('created_at <= ?');
      params.push(options.dateTo);
    }

    if (where.length) {
      query += ' WHERE ' + where.join(' AND ');
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const listQuery = query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    params.push(options.limit, options.offset);

    const [total, logs] = await Promise.all([
      db.prepare(countQuery).bind(...params.slice(0, -2)).first(),
      db.prepare(listQuery).bind(...params).all(),
    ]);

    return {
      items: logs.results || [],
      total: total?.total || 0,
      offset: options.offset,
      limit: options.limit,
      page: Math.floor(options.offset / options.limit) + 1,
    };
  } catch (err) {
    throw new Error(`Failed to get email logs: ${err}`);
  }
}

export async function getEmailById(db: any, id: string) {
  try {
    return await db.prepare(
      'SELECT * FROM admin_emails WHERE id = ?'
    ).bind(id).first();
  } catch (err) {
    throw new Error(`Failed to get email: ${err}`);
  }
}

export async function updateEmailStatus(
  db: any,
  id: string,
  status: string
) {
  try {
    return await db.prepare(
      'UPDATE admin_emails SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(status, id).run();
  } catch (err) {
    throw new Error(`Failed to update email status: ${err}`);
  }
}

export async function resendEmail(db: any, id: string) {
  try {
    // Mark as queued for retry
    await updateEmailStatus(db, id, 'queued');

    // Get email details
    const email = await getEmailById(db, id);
    if (!email) {
      throw new Error('Email not found');
    }

    // TODO: Add to Cloudflare Queue for resending
    return email;
  } catch (err) {
    throw new Error(`Failed to resend email: ${err}`);
  }
}

export async function getEmailTemplates(db: any) {
  try {
    return await db.prepare(
      'SELECT id, name, subject, template, created_at FROM admin_emails WHERE type = ?'
    ).bind('template').all();
  } catch (err) {
    throw new Error(`Failed to get email templates: ${err}`);
  }
}

export async function createEmailTemplate(
  db: any,
  data: {
    name: string;
    subject: string;
    template: string;
  }
) {
  try {
    const id = crypto.randomUUID();
    return await db.prepare(
      'INSERT INTO admin_emails (id, type, name, subject, template, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(id, 'template', data.name, data.subject, data.template).run();
  } catch (err) {
    throw new Error(`Failed to create email template: ${err}`);
  }
}

export async function deleteEmail(db: any, id: string) {
  try {
    return await db.prepare(
      'DELETE FROM admin_emails WHERE id = ?'
    ).bind(id).run();
  } catch (err) {
    throw new Error(`Failed to delete email: ${err}`);
  }
}
