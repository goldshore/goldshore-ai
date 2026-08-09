import { Hono } from 'hono';
import { isValidEmail } from '@goldshore/utils';

const mail = new Hono();

mail.get('/', (c) => c.json({ service: 'gs-api-mail', ok: true }));
mail.get('/health', (c) => c.json({ status: 'ok', service: 'gs-api-mail' }));
mail.get('/inbox/logs', async (c) => {
  const kv = (c.env as any).KV;
  const raw = kv ? await kv.get('EMAIL_INBOX_LOGS') : null;
  return c.json({ logs: raw ? JSON.parse(raw) : [] });
});

interface ContactFormSubmission {
  id: string;
  name: string;
  email: string;
  inquiry: string;
  message: string;
  formType: string;
  status: 'new' | 'read' | 'archived';
  receivedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

const extractString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const validateContactSubmission = (data: Record<string, any>): string[] => {
  const errors: string[] = [];

  const name = extractString(data.name);
  if (!name || name.length < 2 || name.length > 120) {
    errors.push('name');
  }

  const email = extractString(data.email);
  if (!email || !isValidEmail(email)) {
    errors.push('email');
  }

  const inquiry = extractString(data.inquiry);
  const allowedInquiries = ['general', 'strategy-call', 'project-scope', 'support'];
  if (!inquiry || !allowedInquiries.includes(inquiry)) {
    errors.push('inquiry');
  }

  const message = extractString(data.message);
  if (!message || message.length < 20 || message.length > 4000) {
    errors.push('message');
  }

  return errors;
};

const storeContactSubmission = async (db: D1Database, submission: ContactFormSubmission) => {
  await db
    .prepare(
      `INSERT INTO lead_submissions (
        id, form_type, name, email, message, status, received_at, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      submission.userAgent ?? null
    )
    .run();
};

const sendContactNotification = async (
  env: any,
  submission: ContactFormSubmission
): Promise<{ ok: boolean; status: string }> => {
  const notificationEmails = extractString(env.CONTACT_NOTIFICATION_EMAILS).split(',');
  const toAddresses = notificationEmails
    .map((e) => e.trim())
    .filter((e) => isValidEmail(e));

  if (toAddresses.length === 0) {
    return { ok: false, status: 'no_recipients' };
  }

  const subject = `[GoldShore] New ${submission.formType} submission from ${submission.name}`;
  const htmlContent = `
<h2>New Contact Form Submission</h2>
<p><strong>Name:</strong> ${submission.name}</p>
<p><strong>Email:</strong> ${submission.email}</p>
<p><strong>Inquiry Type:</strong> ${submission.inquiry}</p>
<p><strong>Message:</strong></p>
<p>${submission.message.replace(/\n/g, '<br>')}</p>
<p><em>Received: ${submission.receivedAt}</em></p>
  `;

  const textContent = `
New Contact Form Submission

Name: ${submission.name}
Email: ${submission.email}
Inquiry Type: ${submission.inquiry}

Message:
${submission.message}

Received: ${submission.receivedAt}
  `;

  const mailPayload = {
    personalizations: [{ to: toAddresses.map((email) => ({ email })) }],
    from: {
      email: env.MAILCHANNELS_SENDER_EMAIL || 'noreply@goldshore.ai',
      name: 'GoldShore',
    },
    reply_to: { email: submission.email, name: submission.name },
    subject,
    content: [
      { type: 'text/plain', value: textContent },
      { type: 'text/html', value: htmlContent },
    ],
  };

  try {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mailPayload),
    });
    return { ok: response.ok, status: response.status.toString() };
  } catch (error) {
    console.error('Failed to send notification email:', error);
    return { ok: false, status: 'error' };
  }
};

const sendAutoResponder = async (
  env: any,
  email: string,
  name: string
): Promise<{ ok: boolean; status: string }> => {
  const senderEmail = extractString(env.MAILCHANNELS_SENDER_EMAIL || 'noreply@goldshore.ai');

  const htmlContent = `
<p>Hi ${name},</p>
<p>Thank you for reaching out to GoldShore. We've received your inquiry and will review it shortly.</p>
<p>We typically respond within 24 hours during business days.</p>
<p>Best regards,<br>The GoldShore Team</p>
  `;

  const textContent = `Hi ${name},

Thank you for reaching out to GoldShore. We've received your inquiry and will review it shortly.

We typically respond within 24 hours during business days.

Best regards,
The GoldShore Team`;

  const mailPayload = {
    personalizations: [{ to: [{ email }] }],
    from: { email: senderEmail, name: 'GoldShore' },
    subject: 'We received your message — GoldShore',
    content: [
      { type: 'text/plain', value: textContent },
      { type: 'text/html', value: htmlContent },
    ],
  };

  try {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mailPayload),
    });
    return { ok: response.ok, status: response.status.toString() };
  } catch (error) {
    console.error('Failed to send auto-responder:', error);
    return { ok: false, status: 'error' };
  }
};

mail.post('/contact', async (c) => {
  const env = c.env;
  const db = (env as any).PLATFORM_DB as D1Database;

  if (!db) {
    return c.json({ ok: false, error: 'Database unavailable' }, 503);
  }

  const body = await c.req.parseBody();
  const data = Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      value instanceof File ? '' : value,
    ])
  ) as Record<string, any>;

  const validationErrors = validateContactSubmission(data);
  if (validationErrors.length > 0) {
    return c.json(
      { ok: false, error: 'Validation failed', fields: validationErrors },
      400
    );
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

  try {
    await storeContactSubmission(db, submission);
  } catch (error) {
    console.error('Failed to store submission:', error);
    return c.json({ ok: false, error: 'Failed to store submission' }, 500);
  }

  const [notificationResult, responderResult] = await Promise.all([
    sendContactNotification(env, submission),
    sendAutoResponder(env, submission.email, submission.name),
  ]);

  return c.json({
    ok: true,
    submissionId: submission.id,
    mail: {
      notification: notificationResult.ok ? 'sent' : 'failed',
      autoResponder: responderResult.ok ? 'sent' : 'failed',
    },
  });
});

export default mail;
