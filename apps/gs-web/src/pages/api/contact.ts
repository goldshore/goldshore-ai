import type { APIRoute } from 'astro';
import { buildLeadAutoResponder } from '../../emails/leadAutoResponder';
import { isValidEmail } from '../../utils/security';
import { parseJson } from '@goldshore/utils';

// Default to 90 days if not set in environment
const DEFAULT_CONTACT_TTL_SECONDS = 60 * 60 * 24 * 90;
const DEFAULT_MAILCHANNELS_API_URL = 'https://api.mailchannels.net/tx/v1/send';

type Submission = {
  id: string;
  formType: string;
  status: 'new' | 'read' | 'archived';
  name: string;
  email: string;
  company: string;
  role: string;
  website: string;
  teamSize: string;
  industry: string;
  timeline: string;
  budget: string;
  goals: string;
  message: string;
  receivedAt: string;
  ipAddress?: string;
  userAgent?: string;
  inquiry?: string;
  dedupeKey?: string;
};

type FormField = {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
};

type FormRecipient = {
  email: string;
  name?: string;
  channel?: string;
};

type MailRecipient = {
  email: string;
  name?: string;
};

type FormIntegration = {
  type: string;
  enabled?: boolean;
  settings?: Record<string, unknown>;
};

type FormConfig = {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'disabled' | 'archived';
  fields: FormField[];
  recipients: FormRecipient[];
  integrations: FormIntegration[];
  createdAt: string;
  updatedAt: string;
};

type ApiResponseBody = {
  success: boolean;
  code: string;
  message: string;
  submissionId?: string;
  redirectTo?: string;
};

const jsonResponse = (status: number, body: ApiResponseBody) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });

const requestExpectsJson = (request: Request) => {
  const accept = request.headers.get('accept') ?? '';
  const requestedWith = request.headers.get('x-requested-with') ?? '';
  return accept.includes('application/json') || requestedWith === 'XMLHttpRequest';
};

const storeInKv = async (
  kv: KVNamespace,
  submission: Submission,
  autoResponder: ReturnType<typeof buildLeadAutoResponder>,
  ttl: number,
) => {
  await kv.put(`contact:${submission.id}`, JSON.stringify({ submission, autoResponder }), {
    expirationTtl: ttl,
    metadata: {
      formType: submission.formType,
      status: submission.status,
    },
  });
};

const storeInD1 = async (
  db: D1Database,
  submission: Submission,
  autoResponder: ReturnType<typeof buildLeadAutoResponder>,
) => {
  await db
    .prepare(
      `INSERT INTO lead_submissions (
        id,
        form_type,
        name,
        email,
        company,
        role,
        website,
        team_size,
        industry,
        timeline,
        budget,
        goals,
        message,
        status,
        received_at,
        ip_address,
        user_agent,
        auto_responder_subject,
        auto_responder_text,
        auto_responder_html
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      submission.id,
      submission.formType,
      submission.name || null,
      submission.email || null,
      submission.company || null,
      submission.role || null,
      submission.website || null,
      submission.teamSize || null,
      submission.industry || null,
      submission.timeline || null,
      submission.budget || null,
      submission.goals || null,
      submission.message || null,
      submission.status,
      submission.receivedAt,
      submission.ipAddress || null,
      submission.userAgent || null,
      autoResponder.subject,
      autoResponder.text,
      autoResponder.html,
    )
    .run();
};

const extractString = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const normalizeMultiline = (value: string) =>
  value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const allowedInquiryTypes = new Set([
  'general',
  'strategy-call',
  'project-scope',
  'support',
]);

const normalizeContactSubmission = (submission: Submission) => {
  const normalizedEmail = submission.email.trim().toLowerCase();
  const normalizedInquiry = submission.inquiry?.trim().toLowerCase() || 'general';
  return {
    ...submission,
    name: normalizeWhitespace(submission.name),
    email: normalizedEmail,
    inquiry: allowedInquiryTypes.has(normalizedInquiry) ? normalizedInquiry : '',
    message: normalizeMultiline(submission.message),
    dedupeKey: submission.dedupeKey?.trim().toLowerCase() || '',
  };
};

const validateContactSubmission = (submission: Submission): string[] => {
  const errors: string[] = [];
  if (!submission.name || submission.name.length < 2 || submission.name.length > 120) {
    errors.push('name');
  }
  if (!submission.email || !isValidEmail(submission.email)) {
    errors.push('email');
  }
  if (!submission.inquiry || !allowedInquiryTypes.has(submission.inquiry)) {
    errors.push('inquiry');
  }
  if (!submission.message || submission.message.length < 20 || submission.message.length > 4000) {
    errors.push('message');
  }
  if (!submission.dedupeKey || !/^[a-f0-9]{64}$/.test(submission.dedupeKey)) {
    errors.push('dedupeKey');
  }
  return errors;
};

const isSpamSubmission = (formData: FormData) => {
  const honeypot = extractString(formData.get('companyWebsite'));
  if (honeypot) return true;

  const formStartedAt = extractString(formData.get('formStartedAt'));
  if (!formStartedAt) return false;

  const startedAtMs = Number(formStartedAt);
  if (!Number.isFinite(startedAtMs)) return true;

  const elapsedMs = Date.now() - startedAtMs;
  return elapsedMs < 2500;
};

const normalizeFormConfig = (row: Record<string, string> | null, slug: string): FormConfig => {
  const now = new Date().toISOString();
  if (!row) {
    return {
      id: `fallback:${slug}`,
      slug,
      name: `Form: ${slug}`,
      status: 'active',
      fields: [],
      recipients: [],
      integrations: [],
      createdAt: now,
      updatedAt: now
    };
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: (row.status as FormConfig['status']) ?? 'active',
    fields: parseJson<FormField[]>(row.fields ?? null, []),
    recipients: parseJson<FormRecipient[]>(row.recipients ?? null, []),
    integrations: parseJson<FormIntegration[]>(row.integrations ?? null, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const fetchFormConfig = async (db: D1Database, slug: string): Promise<FormConfig> => {
  const result = await db
    .prepare(
      `SELECT id, slug, name, status, fields, recipients, integrations, created_at, updated_at
       FROM form_configs
       WHERE slug = ?
       LIMIT 1`
    )
    .bind(slug)
    .all();

  const row = result?.results?.[0] as Record<string, string> | undefined;
  return normalizeFormConfig(row ?? null, slug);
};

const logSubmissionStatus = async (
  db: D1Database,
  submissionId: string,
  formSlug: string,
  status: string,
  message?: string,
  details?: Record<string, unknown>
) => {
  await db
    .prepare(
      `INSERT INTO form_submission_logs (
        id,
        submission_id,
        form_slug,
        status,
        message,
        details,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      submissionId,
      formSlug,
      status,
      message ?? null,
      details ? JSON.stringify(details) : null,
      new Date().toISOString()
    )
    .run();
};

const validateRequiredFields = (submission: Submission, fields: FormField[]) => {
  const requiredFields = fields.filter((field) => field.required && field.name);
  const missing = requiredFields.filter((field) => {
    const value = (submission as Record<string, string | undefined>)[field.name];
    return !value;
  });

  return missing;
};

const checkRecentDuplicate = async (db: D1Database, submission: Submission): Promise<boolean> => {
  const duplicateResult = await db
    .prepare(
      `SELECT id
       FROM lead_submissions
       WHERE form_type = ?
         AND email = ?
         AND message = ?
         AND received_at >= datetime('now', '-15 minutes')
       LIMIT 1`
    )
    .bind(submission.formType, submission.email, submission.message)
    .first<{ id: string }>();

  return Boolean(duplicateResult?.id);
};

const safeRedirect = (redirectTo: string | null, origin: string) => {
  if (!redirectTo) return new URL('/thank-you', origin);
  const trimmed = redirectTo.trim();
  if (!trimmed.startsWith('/')) return new URL('/thank-you', origin);
  return new URL(trimmed, origin);
};

type ApiSuccessPayload = {
  ok: true;
  submissionId: string;
  redirectTo: string;
  mail: {
    notification: 'sent' | 'failed' | 'skipped';
    autoResponder: 'sent' | 'failed' | 'skipped';
  };
};

type ApiErrorPayload = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

const jsonResponse = (payload: ApiSuccessPayload | ApiErrorPayload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

const buildError = (
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) => jsonResponse({ ok: false, error: { code, message, details } }, status);

const shouldReturnJson = (request: Request) =>
  request.headers.get('x-gs-request-mode') === 'spa' ||
  request.headers.get('accept')?.includes('application/json');

const parseNotificationRecipients = (
  configRecipients: FormRecipient[],
  fallbackRecipients: string | undefined,
): MailRecipient[] => {
  const fromConfig = configRecipients
    .filter((recipient) => isValidEmail(recipient.email))
    .map((recipient) => ({ email: recipient.email, name: recipient.name }));

  if (fromConfig.length > 0) return fromConfig;

  return (fallbackRecipients ?? '')
    .split(',')
    .map((recipient) => recipient.trim())
    .filter((email) => isValidEmail(email))
    .map((email) => ({ email }));
};

export const sendMail = async (
  env: Env,
  to: MailRecipient[],
  subject: string,
  text: string,
  html: string,
  replyTo?: MailRecipient,
) => {
  const fromEmail = env.MAILCHANNELS_SENDER_EMAIL?.trim();
  const fromName = env.MAILCHANNELS_SENDER_NAME?.trim() || 'GoldShore';
  if (!fromEmail || !isValidEmail(fromEmail) || to.length === 0) {
    return {
      attempted: false,
      reason: 'missing_mail_configuration',
    };
  }

  const payload = {
    personalizations: [
      {
        to,
      },
    ],
    from: {
      email: fromEmail,
      name: fromName,
    },
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject,
    content: [
      {
        type: 'text/plain',
        value: text,
      },
      {
        type: 'text/html',
        value: html,
      },
    ],
  };

  const endpoint = env.MAILCHANNELS_API_URL || DEFAULT_MAILCHANNELS_API_URL;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return {
    attempted: true,
    ok: response.ok,
    status: response.status,
    body: await response.text(),
  };
};

export const POST: APIRoute = async ({ request, locals }) => {
  const respondJson = shouldReturnJson(request);

  if (!request.headers.get('content-type')?.includes('form')) {
    return buildError(415, 'unsupported_payload', 'Unsupported payload.');
  }

  const formData = await request.formData();
  const formType = extractString(formData.get('formType')) || 'contact';
  const redirectTo = extractString(formData.get('redirectTo'));
  const isSpam = isSpamSubmission(formData);
  const env = locals.runtime?.env as Env | undefined;

  const submission: Submission = {
    id: crypto.randomUUID(),
    formType,
    status: 'new',
    name: extractString(formData.get('name')),
    email: extractString(formData.get('email')),
    company: extractString(formData.get('company')),
    role: extractString(formData.get('role')),
    website: extractString(formData.get('website')),
    teamSize: extractString(formData.get('teamSize')),
    industry: extractString(formData.get('industry')),
    timeline: extractString(formData.get('timeline')),
    budget: extractString(formData.get('budget')),
    goals: extractString(formData.get('goals')),
    message: extractString(formData.get('message')),
    receivedAt: new Date().toISOString(),
    ipAddress: request.headers.get('CF-Connecting-IP') ?? undefined,
    userAgent: request.headers.get('User-Agent') ?? undefined,
    inquiry: extractString(formData.get('inquiry')),
    dedupeKey: extractString(formData.get('dedupeKey')),
  };

  const env = locals.runtime?.env as Env | undefined;

  if (isSpam) {
    console.info('contact_submission_spam_blocked', {
      submissionId: submission.id,
      formType,
      ipAddress: submission.ipAddress,
    });
    if (env?.DB) {
      await logSubmissionStatus(env.DB, submission.id, formType, 'blocked_spam', 'Spam submission blocked.');
    }
    const redirectUrl = safeRedirect(redirectTo, new URL(request.url).origin);
    if (respondJson) {
      return jsonResponse({
        ok: true,
        submissionId: submission.id,
        redirectTo: redirectUrl.pathname,
        mail: {
          notification: 'skipped',
          autoResponder: 'skipped',
        },
      });
    }
    return Response.redirect(redirectUrl, 303);
  }

  if (submission.email && !isValidEmail(submission.email)) {
    console.info('contact_submission_validation_failed', {
      submissionId: submission.id,
      formType,
      reason: 'invalid_email',
    });
    if (env?.DB) {
      await logSubmissionStatus(env.DB, submission.id, formType, 'rejected', 'Invalid email address.');
    }
    return buildError(400, 'invalid_email', 'Invalid email address.');
  }

  if (!env?.KV && !env?.DB) {
    return buildError(503, 'storage_unavailable', 'Storage unavailable.');
  }

  const formConfig = env?.DB ? await fetchFormConfig(env.DB, formType) : normalizeFormConfig(null, formType);

  if (formConfig.status !== 'active') {
    if (env?.DB) {
      await logSubmissionStatus(env.DB, submission.id, formType, 'blocked', 'Form is not accepting submissions.', {
        status: formConfig.status
      });
    }
    return buildError(403, 'form_inactive', 'Form is not accepting submissions.');
  }

  const missingFields = validateRequiredFields(normalizedSubmission, formConfig.fields);
  if (missingFields.length > 0) {
    console.warn('contact_submission_validation_failed', {
      formType,
      submissionId: submission.id,
      error: 'missing_required_fields',
      fields: missingFields.map((field) => field.name),
    });
    if (env?.DB) {
      await logSubmissionStatus(env.DB, submission.id, formType, 'rejected', 'Missing required fields.', {
        fields: missingFields.map((field) => field.name)
      });
    }
    console.info('contact_submission_validation_failed', {
      submissionId: submission.id,
      formType,
      missingFields: missingFields.map((field) => field.name),
    });
    return buildError(400, 'missing_required_fields', 'Missing required fields.', {
      fields: missingFields.map((field) => field.name),
    });
  }

  const ttl = env?.CONTACT_TTL_SECONDS ? parseInt(env.CONTACT_TTL_SECONDS, 10) : DEFAULT_CONTACT_TTL_SECONDS;

  const autoResponder = buildLeadAutoResponder({
    name: normalizedSubmission.name,
    formType: normalizedSubmission.formType,
  });

  if (env?.DB) {
    const isDuplicate = await checkRecentDuplicate(env.DB, normalizedSubmission);
    if (isDuplicate) {
      await logSubmissionStatus(
        env.DB,
        normalizedSubmission.id,
        formType,
        'duplicate',
        'Repeated submission detected within dedupe window.',
        { dedupeKey: normalizedSubmission.dedupeKey }
      );
      const redirectUrl = safeRedirect(redirectTo, new URL(request.url).origin);
      return Response.redirect(redirectUrl, 303);
    }
  }

  const storageTasks: Promise<unknown>[] = [];
  if (env?.KV)
    storageTasks.push(storeInKv(env.KV, normalizedSubmission, autoResponder, ttl));
  if (env?.DB) storageTasks.push(storeInD1(env.DB, normalizedSubmission, autoResponder));

  const storageResults = await Promise.allSettled(storageTasks);
  const storedSuccessfully = storageResults.some(
    (result) => result.status === 'fulfilled',
  );

  if (!storedSuccessfully) {
    console.error('Contact submission storage failed.', storageResults);
    console.error('contact_submission_persistence_failed', {
      submissionId: submission.id,
      formType,
      storageResults,
    });
    if (env?.DB) {
      await logSubmissionStatus(env.DB, submission.id, formType, 'storage_failed', 'Storage unavailable.');
    }
    return buildError(503, 'storage_unavailable', 'Storage unavailable.');
  }

  if (env?.DB) {
    await logSubmissionStatus(env.DB, normalizedSubmission.id, formType, 'stored', 'Submission stored successfully.', {
      dedupeKey: normalizedSubmission.dedupeKey,
      recipients: formConfig.recipients,
      integrations: formConfig.integrations
    });
  }

  const recipients = parseNotificationRecipients(
    formConfig.recipients,
    env.CONTACT_NOTIFICATION_EMAILS,
  );
  const notificationResult = recipients.length
    ? await sendMail(
        env,
        recipients,
        `[GoldShore] New ${submission.formType} submission`,
        [
          `Name: ${submission.name || 'N/A'}`,
          `Email: ${submission.email || 'N/A'}`,
          `Inquiry: ${extractString(formData.get('inquiry')) || 'general'}`,
          '',
          submission.message || 'No message provided.',
        ].join('\n'),
        `<p><strong>Name:</strong> ${submission.name || 'N/A'}</p>
<p><strong>Email:</strong> ${submission.email || 'N/A'}</p>
<p><strong>Inquiry:</strong> ${extractString(formData.get('inquiry')) || 'general'}</p>
<p><strong>Message:</strong></p>
<p>${submission.message || 'No message provided.'}</p>`,
        submission.email ? { email: submission.email, name: submission.name || undefined } : undefined,
      )
    : { attempted: false, reason: 'no_recipients' };

  const autoResponderResult = submission.email
    ? await sendMail(
        env,
        [{ email: submission.email, name: submission.name || undefined }],
        autoResponder.subject,
        autoResponder.text,
        autoResponder.html,
      )
    : { attempted: false, reason: 'missing_submitter_email' };

  console.info('contact_submission_outbound_email_result', {
    submissionId: submission.id,
    formType,
    notificationResult,
    autoResponderResult,
  });
  if (env?.DB) {
    await logSubmissionStatus(
      env.DB,
      submission.id,
      formType,
      'email_attempted',
      'Outbound email attempts completed.',
      {
        notification: notificationResult,
        autoResponder: autoResponderResult,
      },
    );
  }

  const redirectUrl = safeRedirect(redirectTo, new URL(request.url).origin);
  const successPayload: ApiSuccessPayload = {
    ok: true,
    submissionId: submission.id,
    redirectTo: redirectUrl.pathname,
    mail: {
      notification: notificationResult.attempted
        ? notificationResult.ok
          ? 'sent'
          : 'failed'
        : 'skipped',
      autoResponder: autoResponderResult.attempted
        ? autoResponderResult.ok
          ? 'sent'
          : 'failed'
        : 'skipped',
    },
  };

  if (respondJson) {
    return jsonResponse(successPayload);
  }

  return Response.redirect(redirectUrl, 303);
};

export const GET: APIRoute = async () =>
  jsonResponse(405, {
    success: false,
    code: 'METHOD_NOT_ALLOWED',
    message: 'Method not allowed.',
  });
