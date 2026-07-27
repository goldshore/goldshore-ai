import { Hono } from 'hono';
import { buildAdminSession, verifyAccessWithClaims, type AdminPermission } from '@goldshore/auth';
import { parseJson, isValidEmail } from '@goldshore/utils';
import type { Env } from '../types';
import {
  sendMail,
  parseNotificationRecipients,
  buildLeadAutoResponder,
  buildNewsletterConfirmation,
  buildNewsletterWelcome,
} from '../lib/mail';

const forms = new Hono<{ Bindings: Env }>();
const allowedStatuses = new Set(['new', 'read', 'archived']);

const normalizeRow = (row: Record<string, string>) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  status: row.status,
  fields: parseJson(row.fields ?? null, [] as Record<string, unknown>[]),
  recipients: parseJson(row.recipients ?? null, [] as Record<string, unknown>[]),
  integrations: parseJson(row.integrations ?? null, [] as Record<string, unknown>[]),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const requirePermission = async (request: Request, env: Env, permission: AdminPermission) => {
  if (env.DEV_AUTH_BYPASS === '1') return null;

  const claims = await verifyAccessWithClaims(request, env);
  if (!claims) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  const session = buildAdminSession(claims);
  return session.permissions.includes(permission)
    ? null
    : Response.json({ error: 'Insufficient permissions.' }, { status: 403 });
};

const isSameOriginRequest = (request: Request) => {
  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (!origin || !forwardedHost) return true;
  try { return new URL(origin).host === forwardedHost; } catch { return false; }
};

const escapeCsvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const buildCsv = (rows: Record<string, unknown>[]) => {
  const columns = ['id','form_type','name','email','company','role','website','team_size','industry','timeline','budget','goals','message','status','received_at','ip_address','user_agent'];
  return [columns.map(escapeCsvValue).join(','), ...rows.map((row) => columns.map((col) => escapeCsvValue(row[col])).join(','))].join('\n');
};

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const publicSiteUrl = (env: Env) => (env.PUBLIC_SITE_URL || 'https://goldshore.ai').replace(/\/$/, '');

forms.get('/leads', async (c) => {
  const denied = await requirePermission(c.req.raw, c.env, 'forms:read');
  if (denied) return denied;
  const status = c.req.query('status');
  const whereClause = status && allowedStatuses.has(status) ? 'WHERE status = ?' : '';
  const query = `SELECT id, form_type, name, email, company, role, website, team_size, industry, timeline, budget, goals, message, status, received_at, ip_address, user_agent FROM lead_submissions ${whereClause} ORDER BY received_at DESC`;
  const statement = c.env.PLATFORM_DB.prepare(query);
  const response = whereClause ? await statement.bind(status).all() : await statement.all();
  const rows = Array.isArray(response?.results) ? response.results : [];
  if (c.req.query('format') === 'csv') {
    return new Response(buildCsv(rows as Record<string, unknown>[]), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="lead-submissions.csv"' } });
  }
  return c.json(rows);
});

forms.get('/subscribers', async (c) => {
  const denied = await requirePermission(c.req.raw, c.env, 'forms:read');
  if (denied) return denied;

  const conditions: string[] = [];
  const bindings: string[] = [];
  for (const field of ['status', 'brand', 'list_name', 'source'] as const) {
    const value = c.req.query(field);
    if (value) {
      conditions.push(`${field} = ?`);
      bindings.push(value);
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT id, email, name, brand, list_name, source, status, consent_basis, subscribed_at, confirmed_at, unsubscribed_at, updated_at
    FROM newsletter_subscribers ${where} ORDER BY updated_at DESC`;
  const statement = c.env.PLATFORM_DB.prepare(query);
  const response = bindings.length ? await statement.bind(...bindings).all() : await statement.all();
  const rows = (response?.results ?? []) as Record<string, unknown>[];
  if (c.req.query('format') === 'csv') {
    const columns = ['id', 'email', 'name', 'brand', 'list_name', 'source', 'status', 'consent_basis', 'subscribed_at', 'confirmed_at', 'unsubscribed_at', 'updated_at'];
    const csv = [columns.map(escapeCsvValue).join(','), ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(','))].join('\n');
    return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="newsletter-subscribers.csv"' } });
  }
  return c.json({ subscribers: rows });
});

forms.get('/newsletter/confirm', async (c) => {
  const token = c.req.query('token')?.trim();
  if (!token || token.length < 32) return c.json({ error: 'Invalid confirmation token.' }, 400);
  const tokenHash = await sha256(token);
  const result = await c.env.PLATFORM_DB.prepare(
    `SELECT id, email, name, manage_token_hash, status
     FROM newsletter_subscribers WHERE confirmation_token_hash = ? LIMIT 1`,
  ).bind(tokenHash).all();
  const subscriber = result.results?.[0] as Record<string, string> | undefined;
  if (!subscriber) return c.json({ error: 'Confirmation link is invalid or expired.' }, 404);
  if (subscriber.status === 'suppressed' || subscriber.status === 'unsubscribed') {
    return c.json({ error: 'This address cannot be subscribed.' }, 409);
  }

  const now = new Date().toISOString();
  await c.env.PLATFORM_DB.prepare(
    `UPDATE newsletter_subscribers
     SET status = 'confirmed', confirmed_at = COALESCE(confirmed_at, ?),
         confirmation_token_hash = NULL, updated_at = ?
     WHERE id = ?`,
  ).bind(now, now, subscriber.id).run();

  const manageToken = c.req.query('manage')?.trim();
  const manageTokenIsValid =
    !!manageToken && (await sha256(manageToken)) === subscriber.manage_token_hash;
  const unsubscribeUrl = manageTokenIsValid
    ? `${publicSiteUrl(c.env)}/newsletter/unsubscribe?token=${encodeURIComponent(manageToken)}`
    : `${publicSiteUrl(c.env)}/contact`;
  const welcome = buildNewsletterWelcome({ unsubscribeUrl });
  const mail = await sendMail(
    c.env,
    [{ email: subscriber.email, name: subscriber.name }],
    welcome.subject,
    welcome.text,
    welcome.html,
    { email: 'newsletter@rmarston.com', name: 'GoldShore Newsletter' },
  );
  return c.json({ ok: true, status: 'confirmed', mail });
});

forms.get('/newsletter/unsubscribe', async (c) => {
  const token = c.req.query('token')?.trim();
  if (!token || token.length < 32) return c.json({ error: 'Invalid unsubscribe token.' }, 400);
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const result = await c.env.PLATFORM_DB.prepare(
    `UPDATE newsletter_subscribers
     SET status = 'unsubscribed', unsubscribed_at = ?, updated_at = ?
     WHERE manage_token_hash = ? AND status != 'suppressed'`,
  ).bind(now, now, tokenHash).run();
  return result.meta.changes
    ? c.json({ ok: true, status: 'unsubscribed' })
    : c.json({ error: 'Unsubscribe link is invalid.' }, 404);
});

forms.post('/leads', async (c) => {
  if (!isSameOriginRequest(c.req.raw)) return c.text('Forbidden: CSRF check failed', 403);
  const denied = await requirePermission(c.req.raw, c.env, 'forms:write');
  if (denied) return denied;
  const body = await c.req.parseBody();
  const id = String(body.id || '').trim();
  const status = String(body.status || '').trim();
  if (!id || !allowedStatuses.has(status)) return c.text('Invalid request.', 400);
  await c.env.PLATFORM_DB.prepare('UPDATE lead_submissions SET status = ? WHERE id = ?').bind(status, id).run();
  return c.json({ id, status });
});

forms.get('/configs', async (c) => {
  const denied = await requirePermission(c.req.raw, c.env, 'forms:read');
  if (denied) return denied;
  const result = await c.env.PLATFORM_DB.prepare('SELECT id, slug, name, status, fields, recipients, integrations, created_at, updated_at FROM form_configs ORDER BY updated_at DESC').all();
  return c.json({ configs: (result?.results ?? []).map((row) => normalizeRow(row as Record<string, string>)) });
});

forms.post('/configs', async (c) => {
  if (!isSameOriginRequest(c.req.raw)) return c.json({ error: 'Forbidden: CSRF check failed.' }, 403);
  const denied = await requirePermission(c.req.raw, c.env, 'forms:write');
  if (denied) return denied;
  const payload = await c.req.json<{ slug?: string; name?: string; status?: string; fields?: unknown[]; recipients?: unknown[]; integrations?: unknown[] }>();
  if (!payload.slug || !payload.name) return c.text('Missing required fields.', 400);
  const existing = await c.env.PLATFORM_DB.prepare('SELECT id FROM form_configs WHERE slug = ? LIMIT 1').bind(payload.slug).all();
  if (existing?.results?.length) return c.text('Form config already exists.', 409);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await c.env.PLATFORM_DB.prepare('INSERT INTO form_configs (id, slug, name, status, fields, recipients, integrations, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, payload.slug, payload.name, payload.status ?? 'active', JSON.stringify(payload.fields ?? []), JSON.stringify(payload.recipients ?? []), JSON.stringify(payload.integrations ?? []), now, now).run();
  return c.json({ id, slug: payload.slug, status: payload.status ?? 'active' }, 201);
});

forms.get('/configs/:slug', async (c) => {
  const denied = await requirePermission(c.req.raw, c.env, 'forms:read');
  if (denied) return denied;
  const result = await c.env.PLATFORM_DB.prepare('SELECT id, slug, name, status, fields, recipients, integrations, created_at, updated_at FROM form_configs WHERE slug = ? LIMIT 1').bind(c.req.param('slug')).all();
  const row = result?.results?.[0] as Record<string, string> | undefined;
  return row ? c.json({ config: normalizeRow(row) }) : c.text('Form not found.', 404);
});


const updateConfig = async (c: Parameters<Parameters<typeof forms.put>[1]>[0]) => {
  if (!isSameOriginRequest(c.req.raw)) return c.json({ error: 'Forbidden: CSRF check failed.' }, 403);
  const denied = await requirePermission(c.req.raw, c.env, 'forms:write');
  if (denied) return denied;
  const slug = c.req.param('slug');
  const payload = await c.req.json<{ name?: string; status?: string; fields?: unknown[]; recipients?: unknown[]; integrations?: unknown[] }>();
  const existing = await c.env.PLATFORM_DB.prepare('SELECT id, slug, name, status, fields, recipients, integrations, created_at, updated_at FROM form_configs WHERE slug = ? LIMIT 1').bind(slug).all();
  const row = existing?.results?.[0] as Record<string, string> | undefined;
  if (!row) return c.text('Form not found.', 404);
  const now = new Date().toISOString();
  const updated = { name: payload.name ?? row.name, status: payload.status ?? row.status, fields: payload.fields ?? parseJson(row.fields ?? null, []), recipients: payload.recipients ?? parseJson(row.recipients ?? null, []), integrations: payload.integrations ?? parseJson(row.integrations ?? null, []) };
  await c.env.PLATFORM_DB.prepare('UPDATE form_configs SET name = ?, status = ?, fields = ?, recipients = ?, integrations = ?, updated_at = ? WHERE slug = ?')
    .bind(updated.name, updated.status, JSON.stringify(updated.fields), JSON.stringify(updated.recipients), JSON.stringify(updated.integrations), now, slug).run();
  return c.json({ config: { id: row.id, slug, ...updated, createdAt: row.created_at, updatedAt: now } });
};

forms.put('/configs/:slug', updateConfig);
forms.patch('/configs/:slug', updateConfig);

forms.post('/:formId/submissions', async (c) => {
  const body = await c.req.parseBody();
  const id = crypto.randomUUID();
  const formId = c.req.param('formId') || 'contact';
  const now = new Date().toISOString();
  const name = typeof body.name === 'string' ? body.name : undefined;
  const email = typeof body.email === 'string' ? body.email : undefined;
  const message = typeof body.message === 'string' ? body.message : undefined;

  if (formId === 'newsletter') {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return c.json({ error: 'A valid email address is required.' }, 400);
    }
    const confirmationToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
    const manageToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
    const [emailHash, confirmationTokenHash, manageTokenHash] = await Promise.all([
      sha256(normalizedEmail),
      sha256(confirmationToken),
      sha256(manageToken),
    ]);
    const existing = await c.env.PLATFORM_DB.prepare(
      'SELECT status FROM newsletter_subscribers WHERE email = ? LIMIT 1',
    ).bind(normalizedEmail).all();
    const existingStatus = (existing.results?.[0] as { status?: string } | undefined)?.status;
    if (existingStatus === 'suppressed' || existingStatus === 'unsubscribed') {
      return c.json({ ok: true, status: 'received' }, 202);
    }
    if (existingStatus === 'confirmed') {
      return c.json({ ok: true, status: 'confirmed' }, 200);
    }

    await c.env.PLATFORM_DB.prepare(
      `INSERT INTO newsletter_subscribers
       (id, email, email_hash, name, brand, list_name, source, status, consent_basis,
        confirmation_token_hash, manage_token_hash, subscribed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'goldshore', 'newsletter', 'website', 'pending', 'double_opt_in', ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         confirmation_token_hash = excluded.confirmation_token_hash,
         manage_token_hash = excluded.manage_token_hash,
         subscribed_at = excluded.subscribed_at,
         updated_at = excluded.updated_at`,
    ).bind(
      id,
      normalizedEmail,
      emailHash,
      name ?? null,
      confirmationTokenHash,
      manageTokenHash,
      now,
      now,
      now,
    ).run();

    const confirmationUrl = `${publicSiteUrl(c.env)}/newsletter/confirm?token=${encodeURIComponent(confirmationToken)}&manage=${encodeURIComponent(manageToken)}`;
    const confirmation = buildNewsletterConfirmation({ confirmationUrl });
    const mail = await sendMail(
      c.env,
      [{ email: normalizedEmail, name }],
      confirmation.subject,
      confirmation.text,
      confirmation.html,
      { email: 'newsletter@rmarston.com', name: 'GoldShore Newsletter' },
    );
    return c.json({ ok: true, status: 'pending_confirmation', formId, submissionId: id, submittedAt: now, mail }, 202);
  }

  await c.env.PLATFORM_DB.prepare(`INSERT INTO lead_submissions (id, form_type, name, email, company, role, website, team_size, industry, timeline, budget, goals, message, status, received_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`)
    .bind(id, formId, body.name ?? null, body.email ?? null, body.company ?? null, body.role ?? null, body.website ?? null, body.teamSize ?? null, body.industry ?? null, body.timeline ?? null, body.budget ?? null, body.goals ?? null, body.message ?? null, now, c.req.header('CF-Connecting-IP') ?? null, c.req.header('User-Agent') ?? null).run();

  const configResult = await c.env.PLATFORM_DB.prepare('SELECT recipients FROM form_configs WHERE slug = ? LIMIT 1').bind(formId).all();
  const configRow = configResult?.results?.[0] as Record<string, string> | undefined;
  const configRecipients = parseJson(configRow?.recipients ?? null, [] as Array<{ email?: string; name?: string }>);
  const recipients = parseNotificationRecipients(configRecipients, c.env.CONTACT_NOTIFICATION_EMAILS);

  const notificationResult = recipients.length
    ? await sendMail(
        c.env,
        recipients,
        `[GoldShore] New ${formId} submission`,
        [
          `Name: ${name || 'N/A'}`,
          `Email: ${email || 'N/A'}`,
          '',
          message || 'No message provided.',
        ].join('\n'),
        `<p><strong>Name:</strong> ${name || 'N/A'}</p><p><strong>Email:</strong> ${email || 'N/A'}</p><p>${message || 'No message provided.'}</p>`,
        email && isValidEmail(email) ? { email, name } : undefined,
      )
    : { attempted: false, reason: 'no_recipients' };

  const autoResponder = buildLeadAutoResponder({ name, formType: formId });
  const autoResponderResult =
    email && isValidEmail(email)
      ? await sendMail(c.env, [{ email, name }], autoResponder.subject, autoResponder.text, autoResponder.html)
      : { attempted: false, reason: 'missing_submitter_email' };

  return c.json({ ok: true, status: 'received', formId, submissionId: id, submittedAt: now, redirectTo: String(body.redirectTo || '/contact?submitted=1'), mail: { notification: notificationResult, autoResponder: autoResponderResult } }, 202);
});

export default forms;
