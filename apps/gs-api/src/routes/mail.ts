import { Hono } from 'hono';
import { escapeHtml, isValidEmail } from '@goldshore/utils';
import type { Env, Variables } from '../types';
import { enqueueMailJob } from '../lib/mail-queue';
import { validateFormTurnstile } from '../lib/turnstile';

const mail = new Hono<{ Bindings: Env; Variables: Variables }>();

mail.get('/', (c) => c.json({ service: 'gs-api-mail', ok: true }));
mail.get('/health', (c) => c.json({ status: 'ok', service: 'gs-api-mail' }));
mail.get('/inbox/logs', async (c) => {
  const result = await c.env.PLATFORM_DB.prepare(
    `SELECT id, envelope_from AS "from", envelope_to AS "to", subject, received_at AS timestamp,
            status, raw_object_key AS rawObjectKey, attachment_count AS attachmentCount
       FROM inbound_messages
      ORDER BY received_at DESC
      LIMIT 100`,
  ).all();
  return c.json({ logs: result.results ?? [] });
});

type ContactFormSubmission = {
  id: string;
  name: string;
  email: string;
  inquiry: string;
  message: string;
  formType: string;
  status: 'new';
  receivedAt: string;
  ipAddress?: string;
  userAgent?: string;
};

const extractString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const validateContactSubmission = (data: Record<string, unknown>) => {
  const errors: string[] = [];
  const name = extractString(data.name);
  const email = extractString(data.email);
  const inquiry = extractString(data.inquiry);
  const message = extractString(data.message);
  if (!name || name.length < 2 || name.length > 120) errors.push('name');
  if (!email || !isValidEmail(email)) errors.push('email');
  if (!['general', 'strategy-call', 'project-scope', 'support'].includes(inquiry)) {
    errors.push('inquiry');
  }
  if (!message || message.length < 20 || message.length > 4000) errors.push('message');
  return errors;
};

mail.post('/contact', async (c) => {
  const body = await c.req.parseBody();
  const formData = new FormData();
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      data[key] = value;
      formData.set(key, value);
    }
  }

  const turnstile = await validateFormTurnstile(
    formData,
    c.env.TURNSTILE_SECRET_KEY,
    c.req.raw,
  );
  if (!turnstile.valid) {
    return c.json({ ok: false, error: turnstile.error ?? 'Turnstile validation failed' }, 400);
  }

  const validationErrors = validateContactSubmission(data);
  if (validationErrors.length > 0) {
    return c.json({ ok: false, error: 'Validation failed', fields: validationErrors }, 400);
  }

  const submission: ContactFormSubmission = {
    id: crypto.randomUUID(),
    name: extractString(data.name),
    email: extractString(data.email),
    inquiry: extractString(data.inquiry),
    message: extractString(data.message),
    formType: extractString(data.formType) || 'contact',
    status: 'new',
    receivedAt: new Date().toISOString(),
    ipAddress: c.req.header('CF-Connecting-IP'),
    userAgent: c.req.header('User-Agent'),
  };

  await c.env.PLATFORM_DB.prepare(
    `INSERT INTO lead_submissions
      (id, form_type, name, email, message, status, received_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      submission.id,
      submission.formType,
      submission.name,
      submission.email,
      submission.message,
      submission.status,
      submission.receivedAt,
      submission.ipAddress ?? null,
      submission.userAgent ?? null,
    )
    .run();

  const notificationRecipients = (c.env.CONTACT_NOTIFICATION_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(isValidEmail)
    .map((email) => ({ email }));

  const notification = notificationRecipients.length
    ? await enqueueMailJob(c.env, {
        to: notificationRecipients,
        replyTo: { email: submission.email, name: submission.name },
        subject: `[GoldShore] New ${submission.formType} submission from ${submission.name}`,
        text: `Name: ${submission.name}\nEmail: ${submission.email}\nInquiry: ${submission.inquiry}\n\n${submission.message}`,
        html: `<h2>New Contact Form Submission</h2><p><strong>Name:</strong> ${escapeHtml(submission.name)}</p><p><strong>Email:</strong> ${escapeHtml(submission.email)}</p><p><strong>Inquiry:</strong> ${escapeHtml(submission.inquiry)}</p><p>${escapeHtml(submission.message).replace(/\n/g, '<br>')}</p>`,
      })
    : { attempted: false as const, reason: 'no_recipients' };

  const autoResponder = await enqueueMailJob(c.env, {
    to: [{ email: submission.email, name: submission.name }],
    subject: 'We received your message — GoldShore',
    text: `Hi ${submission.name},\n\nThank you for reaching out to GoldShore. We received your inquiry and will review it shortly.\n\nThe GoldShore Team`,
    html: `<p>Hi ${escapeHtml(submission.name)},</p><p>Thank you for reaching out to GoldShore. We received your inquiry and will review it shortly.</p><p>The GoldShore Team</p>`,
  });

  return c.json({
    ok: true,
    submissionId: submission.id,
    mail: {
      notification: notification.attempted && notification.ok ? 'queued' : 'failed',
      autoResponder: autoResponder.attempted && autoResponder.ok ? 'queued' : 'failed',
    },
  });
});

export default mail;
