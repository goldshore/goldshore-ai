import type { APIRoute } from 'astro';

export const prerender = false;

const shouldReturnJson = (request: Request) => {
  const accept = request.headers.get('accept') ?? '';
  const requestedWith = request.headers.get('x-requested-with') ?? '';
  return accept.includes('application/json') || requestedWith.toLowerCase() === 'fetch';
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

const contactJsonResponse = (payload: ApiSuccessPayload | ApiErrorPayload, status = 200) =>
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
) => contactJsonResponse({ ok: false, error: { code, message, details } }, status);

const shouldReturnJson = (request: Request) =>
  request.headers.get('x-gs-request-mode') === 'spa' ||
  request.headers.get('accept')?.includes('application/json');

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

const apiBase = (env: Env | undefined) =>
  (env?.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');

const safeRedirect = (value: string | null, origin: string) => {
  if (!value) return new URL('/contact?submitted=1', origin);
  if (value.startsWith('/') && !value.startsWith('//')) return new URL(value, origin);
  try {
    const parsed = new URL(value);
    return parsed.origin === origin ? parsed : new URL('/contact?submitted=1', origin);
  } catch {
    return new URL('/contact?submitted=1', origin);
  }
};

const forwardedHeaders = (request: Request) => {
  const headers = new Headers();
  for (const name of ['accept', 'cf-connecting-ip', 'user-agent', 'x-forwarded-for']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!request.headers.get('content-type')?.includes('form')) {
    return buildError(request, 415, 'unsupported_payload', 'Unsupported payload.');
  }

  const formData = await request.formData();
  const formType = String(formData.get('formType') || 'contact');
  const redirectTo = String(formData.get('redirectTo') || '');
  const env = locals.runtime?.env as Env | undefined;
  const target = new URL(`${apiBase(env)}/v1/forms/${encodeURIComponent(formType)}/submissions`);

  let response: Response;
  try {
    response = await fetch(target, {
      method: 'POST',
      headers: forwardedHeaders(request),
      body: formData,
    });
    if (env?.DB) {
      await logSubmissionStatus(env.DB, submission.id, formType, 'blocked_spam', 'Spam submission blocked.');
    }
    const redirectUrl = safeRedirect(redirectTo, new URL(request.url).origin);
    if (respondJson) {
      return contactJsonResponse({
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
  } catch {
    return buildError(request, 503, 'api_unavailable', 'Submission service unavailable.');
  }

  const responseText = await response.text();
  let payload: Record<string, unknown> | null = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (shouldReturnJson(request)) {
      return Response.json(payload ?? { ok: false, code: 'submission_failed' }, {
        status: response.status,
      });
    }
    return new Response(responseText || 'Submission failed.', { status: response.status });
  }

  const payloadRedirect = typeof payload?.redirectTo === 'string' ? payload.redirectTo : null;
  const redirectUrl = safeRedirect(payloadRedirect ?? redirectTo, new URL(request.url).origin);

  if (shouldReturnJson(request)) {
    return Response.json(payload ?? { ok: true, redirectTo: redirectUrl.pathname }, {
      status: response.status,
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
    return contactJsonResponse(successPayload);
  }

  return Response.redirect(redirectUrl, 303);
};

export const GET: APIRoute = async ({ request }) =>
  buildError(request, 405, 'method_not_allowed', 'Method not allowed.');
