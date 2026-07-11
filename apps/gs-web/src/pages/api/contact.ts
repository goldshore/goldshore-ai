import type { APIRoute } from 'astro';

const shouldReturnJson = (request: Request) => {
  const accept = request.headers.get('accept') ?? '';
  const requestedWith = request.headers.get('x-requested-with') ?? '';
  return accept.includes('application/json') || requestedWith.toLowerCase() === 'fetch';
};

const buildError = (request: Request, status: number, code: string, message: string) =>
  shouldReturnJson(request)
    ? Response.json({ ok: false, code, message }, { status })
    : new Response(message, { status });

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

export const POST: APIRoute = async ({ request, locals }) => {
  if (!request.headers.get('content-type')?.includes('form')) {
    return buildError(request, 415, 'unsupported_payload', 'Unsupported payload.');
  }

  const formData = await request.formData();
  const formType = String(formData.get('formType') || 'contact');
  const redirectTo = String(formData.get('redirectTo') || '');
  const env = locals.runtime?.env as Env | undefined;
  const target = new URL(`${apiBase(env)}/v1/forms/${encodeURIComponent(formType)}/submissions`);
  const headers = new Headers(request.headers);
  headers.delete('content-length');

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

  const normalizedSubmission = normalizeContactSubmission(submission);

  if (isSpam) {
    console.info('contact_submission_spam_blocked', {
      submissionId: submission.id,
      formType,
      ipAddress: submission.ipAddress,
    });
    if (env?.PLATFORM_DB) {
      await logSubmissionStatus(env.PLATFORM_DB, submission.id, formType, 'blocked_spam', 'Spam submission blocked.');
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
    if (env?.PLATFORM_DB) {
      await logSubmissionStatus(env.PLATFORM_DB, submission.id, formType, 'rejected', 'Invalid email address.');
    }
    return buildError(400, 'invalid_email', 'Invalid email address.');
  }

  if (!env?.KV && !env?.PLATFORM_DB) {
    return buildError(503, 'storage_unavailable', 'Storage unavailable.');
  }

  const formConfig = env?.PLATFORM_DB ? await fetchFormConfig(env.PLATFORM_DB, formType) : normalizeFormConfig(null, formType);

  if (formConfig.status !== 'active') {
    if (env?.PLATFORM_DB) {
      await logSubmissionStatus(env.PLATFORM_DB, submission.id, formType, 'blocked', 'Form is not accepting submissions.', {
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
    if (env?.PLATFORM_DB) {
      await logSubmissionStatus(env.PLATFORM_DB, submission.id, formType, 'rejected', 'Missing required fields.', {
        fields: missingFields.map((field) => field.name)
      });
    }
    return buildError(400, 'missing_required_fields', 'Missing required fields.', {
      fields: missingFields.map((field) => field.name),
    });
  }

  const ttl = env?.CONTACT_TTL_SECONDS ? parseInt(env.CONTACT_TTL_SECONDS, 10) : DEFAULT_CONTACT_TTL_SECONDS;

  const autoResponder = buildLeadAutoResponder({
    name: normalizedSubmission.name,
    formType: normalizedSubmission.formType,
  });

  if (env?.PLATFORM_DB) {
    const isDuplicate = await checkRecentDuplicate(env.PLATFORM_DB, normalizedSubmission);
    if (isDuplicate) {
      await logSubmissionStatus(
        env.PLATFORM_DB,
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
  if (env?.PLATFORM_DB) storageTasks.push(storeInD1(env.PLATFORM_DB, normalizedSubmission, autoResponder));

  const storageResults = await Promise.allSettled(storageTasks);
  const storedSuccessfully = storageResults.some(
    (result) => result.status === 'fulfilled',
  );

  if (!storedSuccessfully) {
    console.error('contact_submission_persistence_failed', {
      submissionId: submission.id,
      formType,
      storageResults,
    });
    if (env?.PLATFORM_DB) {
      await logSubmissionStatus(env.PLATFORM_DB, submission.id, formType, 'storage_failed', 'Storage unavailable.');
    }
    return buildError(503, 'storage_unavailable', 'Storage unavailable.');
  }

  if (env?.PLATFORM_DB) {
    await logSubmissionStatus(env.PLATFORM_DB, normalizedSubmission.id, formType, 'stored', 'Submission stored successfully.', {
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
  if (env?.PLATFORM_DB) {
    await logSubmissionStatus(
      env.PLATFORM_DB,
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

  const redirectUrl = safeRedirect(payload?.redirectTo ?? redirectTo, new URL(request.url).origin);
  if (shouldReturnJson(request)) {
    return Response.json({ ok: true, submissionId: payload?.submissionId, redirectTo: redirectUrl.pathname, mail: payload?.mail });
  }
  return Response.redirect(redirectUrl, 303);
};
