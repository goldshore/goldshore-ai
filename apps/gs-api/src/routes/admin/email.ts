import { Hono } from 'hono';
import * as emailDb from './db/email';
import { verifyAdminAuth, parsePagination, errorHandler } from './middleware/auth';
import type { Env, Variables } from '../../types';

const email = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply auth middleware to all email routes
email.use('*', verifyAdminAuth);
email.use('*', parsePagination);

/**
 * GET /api/admin/email/status
 * Get email queue status (queued, sent, failed counts)
 */
email.get('/status', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const status = await emailDb.getEmailQueueStatus(db);
  return c.json(status);
}));

/**
 * GET /api/admin/email/logs
 * List email logs with pagination
 * Query params: offset, limit, status, dateFrom, dateTo
 */
email.get('/logs', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const { offset, limit } = c.get('pagination');

  const logs = await emailDb.getEmailLogs(db, {
    offset,
    limit,
    status: c.req.query('status'),
    dateFrom: c.req.query('dateFrom'),
    dateTo: c.req.query('dateTo'),
  });

  return c.json(logs);
}));

/**
 * GET /api/admin/email/logs/:id
 * Get single email log entry
 */
email.get('/logs/:id', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');

  const mailLog = await emailDb.getEmailById(db, id);
  if (!mailLog) {
    return c.json({ error: 'Email not found' }, 404);
  }

  return c.json(mailLog);
}));

/**
 * POST /api/admin/email/logs/:id/resend
 * Resend failed email via queue
 */
email.post('/logs/:id/resend', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const queue = c.env.MAIL_JOBS_QUEUE;
  const id = c.req.param('id');
  const user = c.get('user');

  if (!queue) {
    return c.json({ error: 'Mail queue not configured' }, 503);
  }

  const resent = await emailDb.resendEmail(db, id, queue);

  // Log to audit
  console.log('[AUDIT] Admin email resend', {
    user: user.email,
    emailId: id,
    timestamp: new Date().toISOString(),
  });

  return c.json({
    success: true,
    message: 'Email marked for resend and queued',
    email: resent,
  });
}));

/**
 * GET /api/admin/email/templates
 * List email templates
 */
email.get('/templates', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const templates = await emailDb.getEmailTemplates(db);
  return c.json({ items: templates || [] });
}));

/**
 * POST /api/admin/email/templates
 * Create new email template
 * Body: { name, subject, template }
 */
email.post('/templates', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.name || !body.subject || !body.template) {
    return c.json({
      error: 'Missing required fields: name, subject, template'
    }, 400);
  }

  await emailDb.createEmailTemplate(db, body);

  console.log('[AUDIT] Admin email template created', {
    user: user.email,
    template: body.name,
    timestamp: new Date().toISOString(),
  });

  return c.json({
    success: true,
    message: 'Template created',
  }, 201);
}));

/**
 * DELETE /api/admin/email/logs/:id
 * Delete email log entry
 */
email.delete('/logs/:id', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');
  const user = c.get('user');

  await emailDb.deleteEmail(db, id);

  console.log('[AUDIT] Admin email deleted', {
    user: user.email,
    emailId: id,
    timestamp: new Date().toISOString(),
  });

  return c.json({
    success: true,
    message: 'Email deleted',
  });
}));

export default email;
