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

const safeRedirect = (redirectTo: string | null, origin: string) => {
  if (!redirectTo) return new URL('/thank-you', origin);
  const trimmed = redirectTo.trim();
  if (!trimmed.startsWith('/')) return new URL('/thank-you', origin);
  return new URL(trimmed, origin);
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
  if (!request.headers.get('content-type')?.includes('form')) {
    return new Response('Unsupported payload.', { status: 415 });
  }

  const formData = await request.formData();
  const formType = extractString(formData.get('formType')) || 'contact';
  const redirectTo = extractString(formData.get('redirectTo'));
  const isSpam = isSpamSubmission(formData);

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
  };

  if (isSpam) {
    const redirectUrl = safeRedirect(redirectTo, new URL(request.url).origin);
    return Response.redirect(redirectUrl, 303);
  }

  if (submission.email && !isValidEmail(submission.email)) {
    return new Response('Invalid email address.', { status: 400 });
  }

  const env = locals.runtime?.env as Env | undefined;

  if (!env?.KV && !env?.DB) {
    return new Response('Storage unavailable.', { status: 503 });
  }

  const formConfig = env?.DB ? await fetchFormConfig(env.DB, formType) : normalizeFormConfig(null, formType);

  if (formConfig.status !== 'active') {
    if (env?.DB) {
      await logSubmissionStatus(env.DB, submission.id, formType, 'blocked', 'Form is not accepting submissions.', {
        status: formConfig.status
      });
    }
    return new Response('Form is not accepting submissions.', { status: 403 });
  }

  const missingFields = validateRequiredFields(submission, formConfig.fields);
  if (missingFields.length > 0) {
    if (env?.DB) {
      await logSubmissionStatus(env.DB, submission.id, formType, 'rejected', 'Missing required fields.', {
        fields: missingFields.map((field) => field.name)
      });
    }
    return new Response('Missing required fields.', { status: 400 });
  }

  const ttl = env?.CONTACT_TTL_SECONDS ? parseInt(env.CONTACT_TTL_SECONDS, 10) : DEFAULT_CONTACT_TTL_SECONDS;

  const autoResponder = buildLeadAutoResponder({
    name: submission.name,
    formType: submission.formType,
  });

  const storageTasks: Promise<unknown>[] = [];
  if (env?.KV)
    storageTasks.push(storeInKv(env.KV, submission, autoResponder, ttl));
  if (env?.DB) storageTasks.push(storeInD1(env.DB, submission, autoResponder));

  const storageResults = await Promise.allSettled(storageTasks);
  const storedSuccessfully = storageResults.some(
    (result) => result.status === 'fulfilled',
  );

  if (!storedSuccessfully) {
    console.error('Contact submission storage failed.', storageResults);
    if (env?.DB) {
      await logSubmissionStatus(env.DB, submission.id, formType, 'storage_failed', 'Storage unavailable.');
    }
    return new Response('Storage unavailable.', { status: 503 });
  }

  if (env?.DB) {
    await logSubmissionStatus(env.DB, submission.id, formType, 'stored', 'Submission stored successfully.', {
      recipients: formConfig.recipients,
      integrations: formConfig.integrations
    });
  }

  const redirectUrl = safeRedirect(redirectTo, new URL(request.url).origin);
  return Response.redirect(redirectUrl, 303);
};

export const GET: APIRoute = async () =>
  new Response('Method not allowed.', { status: 405 });
