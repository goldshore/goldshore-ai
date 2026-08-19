/**
 * Email management database queries
 * Handles email templates, queue, logs, and analytics
 */

export async function getEmailQueueStatus(db: any) {
  try {
    const [pending, processing, sent, failed] = await Promise.all([
      db.prepare(
        'SELECT COUNT(*) as count FROM email_queue WHERE status = ?'
      ).bind('pending').first(),
      db.prepare(
        'SELECT COUNT(*) as count FROM email_queue WHERE status = ?'
      ).bind('processing').first(),
      db.prepare(
        'SELECT COUNT(*) as count FROM email_queue WHERE status = ?'
      ).bind('sent').first(),
      db.prepare(
        'SELECT COUNT(*) as count FROM email_queue WHERE status = ?'
      ).bind('failed').first(),
    ]);

    return {
      pending: pending?.count || 0,
      processing: processing?.count || 0,
      sent: sent?.count || 0,
      failed: failed?.count || 0,
      total: (pending?.count || 0) + (processing?.count || 0) + (sent?.count || 0) + (failed?.count || 0),
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
    let query = 'SELECT id, to_email, to_name, subject, status, delivery_status, created_at, delivered_at, opened_count, click_count FROM email_logs';
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

    const countQuery = query.replace('SELECT id, to_email, to_name, subject, status, delivery_status, created_at, delivered_at, opened_count, click_count', 'SELECT COUNT(*) as total');
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

export async function getEmailLogById(db: any, id: string) {
  try {
    return await db.prepare(
      'SELECT * FROM email_logs WHERE id = ?'
    ).bind(id).first();
  } catch (err) {
    throw new Error(`Failed to get email log: ${err}`);
  }
}

export async function getQueueItemById(db: any, id: string) {
  try {
    return await db.prepare(
      'SELECT * FROM email_queue WHERE id = ?'
    ).bind(id).first();
  } catch (err) {
    throw new Error(`Failed to get queue item: ${err}`);
  }
}

export async function updateQueueItemStatus(
  db: any,
  id: string,
  status: string,
  errorMessage?: string
) {
  try {
    const query = errorMessage
      ? 'UPDATE email_queue SET status = ?, error_message = ? WHERE id = ?'
      : 'UPDATE email_queue SET status = ? WHERE id = ?';

    const params = errorMessage ? [status, errorMessage, id] : [status, id];

    return await db.prepare(query).bind(...params).run();
  } catch (err) {
    throw new Error(`Failed to update queue item status: ${err}`);
  }
}

export async function resendEmail(db: any, id: string, queue?: any) {
  try {
    // Get email log details
    const emailLog = await getEmailLogById(db, id);
    if (!emailLog) {
      throw new Error('Email log not found');
    }

    // Create a new queue item for retry
    const queueId = crypto.randomUUID();
    const variables = emailLog.metadata ? JSON.parse(emailLog.metadata) : {};

    await db.prepare(
      `INSERT INTO email_queue (id, template_id, to_email, to_name, variables, status, retry_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      queueId,
      emailLog.template_id,
      emailLog.to_email,
      emailLog.to_name,
      JSON.stringify(variables),
      'pending',
      0
    ).run();

    // Queue for sending if queue is available
    if (queue) {
      await queue.send({
        type: 'email.send',
        queueId: queueId,
        templateId: emailLog.template_id,
        to: emailLog.to_email,
        toName: emailLog.to_name,
        variables: variables,
      });
    }

    return { id: queueId, status: 'pending' };
  } catch (err) {
    throw new Error(`Failed to resend email: ${err}`);
  }
}

export async function createEmailTemplate(
  db: any,
  data: {
    name: string;
    subject: string;
    body: string;
    htmlBody?: string;
    plainTextBody?: string;
    category?: string;
    variables?: string[];
  },
  createdBy: string
) {
  try {
    const id = crypto.randomUUID();
    return await db.prepare(
      `INSERT INTO email_templates
       (id, name, subject, body, html_body, plain_text_body, category, variables, is_active, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`
    ).bind(
      id,
      data.name,
      data.subject,
      data.body,
      data.htmlBody || null,
      data.plainTextBody || null,
      data.category || 'transactional',
      JSON.stringify(data.variables || []),
      createdBy
    ).run();
  } catch (err) {
    throw new Error(`Failed to create email template: ${err}`);
  }
}

export async function getEmailTemplates(db: any, activeOnly = true) {
  try {
    const query = activeOnly
      ? 'SELECT id, name, subject, body, html_body, category, variables, is_active, created_at FROM email_templates WHERE is_active = 1 ORDER BY created_at DESC'
      : 'SELECT id, name, subject, body, html_body, category, variables, is_active, created_at FROM email_templates ORDER BY created_at DESC';

    const result = await db.prepare(query).all();
    return result.results || [];
  } catch (err) {
    throw new Error(`Failed to get email templates: ${err}`);
  }
}

export async function getEmailTemplateById(db: any, id: string) {
  try {
    return await db.prepare(
      'SELECT * FROM email_templates WHERE id = ?'
    ).bind(id).first();
  } catch (err) {
    throw new Error(`Failed to get email template: ${err}`);
  }
}

export async function updateEmailTemplate(
  db: any,
  id: string,
  data: Partial<{
    name: string;
    subject: string;
    body: string;
    htmlBody: string;
    plainTextBody: string;
    category: string;
    variables: string[];
    isActive: boolean;
  }>
) {
  try {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.subject !== undefined) {
      updates.push('subject = ?');
      values.push(data.subject);
    }
    if (data.body !== undefined) {
      updates.push('body = ?');
      values.push(data.body);
    }
    if (data.htmlBody !== undefined) {
      updates.push('html_body = ?');
      values.push(data.htmlBody);
    }
    if (data.plainTextBody !== undefined) {
      updates.push('plain_text_body = ?');
      values.push(data.plainTextBody);
    }
    if (data.category !== undefined) {
      updates.push('category = ?');
      values.push(data.category);
    }
    if (data.variables !== undefined) {
      updates.push('variables = ?');
      values.push(JSON.stringify(data.variables));
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return { changes: 0 };
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE email_templates SET ${updates.join(', ')} WHERE id = ?`;
    return await db.prepare(query).bind(...values).run();
  } catch (err) {
    throw new Error(`Failed to update email template: ${err}`);
  }
}

export async function deleteEmailTemplate(db: any, id: string) {
  try {
    return await db.prepare(
      'DELETE FROM email_templates WHERE id = ?'
    ).bind(id).run();
  } catch (err) {
    throw new Error(`Failed to delete email template: ${err}`);
  }
}

export async function deleteEmailLog(db: any, id: string) {
  try {
    return await db.prepare(
      'DELETE FROM email_logs WHERE id = ?'
    ).bind(id).run();
  } catch (err) {
    throw new Error(`Failed to delete email log: ${err}`);
  }
}

export async function queueEmail(
  db: any,
  data: {
    templateId: string;
    toEmail: string;
    toName?: string;
    variables?: Record<string, any>;
    priority?: number;
    scheduledFor?: string;
  }
) {
  try {
    const id = crypto.randomUUID();
    return await db.prepare(
      `INSERT INTO email_queue
       (id, template_id, to_email, to_name, variables, status, priority, scheduled_for, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      id,
      data.templateId,
      data.toEmail,
      data.toName || null,
      JSON.stringify(data.variables || {}),
      'pending',
      data.priority || 0,
      data.scheduledFor || null
    ).run();
  } catch (err) {
    throw new Error(`Failed to queue email: ${err}`);
  }
}
