import { Hono } from 'hono';
import { verifyAdminAuth, parsePagination, errorHandler } from './middleware/auth';
import * as emailDb from './db/email';

const email = new Hono();

// Apply auth middleware to all email routes
email.use('*', verifyAdminAuth);
email.use('*', parsePagination);

/**
 * GET /api/admin/email/status
 * Get email queue status (queued, sent, failed counts)
 */
email.get('/status', errorHandler(async (c) => {
  const db = c.env.DB;
  const status = await emailDb.getEmailQueueStatus(db);
  return c.json(status);
}));

/**
 * GET /api/admin/email/logs
 * List email logs with pagination
 * Query params: offset, limit, status, dateFrom, dateTo
 */
email.get('/logs', errorHandler(async (c) => {
  const db = c.env.DB;
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
  const db = c.env.DB;
  const id = c.req.param('id');

  const email = await emailDb.getEmailById(db, id);
  if (!email) {
    return c.json({ error: 'Email not found' }, 404);
  }

  return c.json(email);
}));

/**
 * POST /api/admin/email/logs/:id/resend
 * Resend failed email
 */
email.post('/logs/:id/resend', errorHandler(async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const user = c.get('user');

  const resent = await emailDb.resendEmail(db, id);

  // Log to audit
  console.log(`[AUDIT] ${user.email} resent email ${id}`);

  return c.json({
    success: true,
    message: 'Email marked for resend',
    email: resent,
  });
}));

/**
 * GET /api/admin/email/templates
 * List email templates
 */
email.get('/templates', errorHandler(async (c) => {
  const db = c.env.DB;
  const templates = await emailDb.getEmailTemplates(db);
  return c.json({ items: templates || [] });
}));

/**
 * POST /api/admin/email/templates
 * Create new email template
 * Body: { name, subject, template }
 */
email.post('/templates', errorHandler(async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.name || !body.subject || !body.template) {
    return c.json({
      error: 'Missing required fields: name, subject, template'
    }, 400);
  }

  await emailDb.createEmailTemplate(db, body);

  console.log(`[AUDIT] ${user.email} created email template: ${body.name}`);

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
  const db = c.env.DB;
  const id = c.req.param('id');
  const user = c.get('user');

  await emailDb.deleteEmail(db, id);

  console.log(`[AUDIT] ${user.email} deleted email ${id}`);

  return c.json({
    success: true,
    message: 'Email deleted',
  });
}));

export default email;
