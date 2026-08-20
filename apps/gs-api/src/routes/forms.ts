import { Hono, type Context } from 'hono';
import { buildAdminSession, type AccessTokenPayload, type AdminPermission } from '@goldshore/auth';
import { escapeHtml, parseJson, isValidEmail } from '@goldshore/utils';
import type { Env, Variables } from '../types';
import {
  parseNotificationRecipients,
  buildLeadAutoResponder,
  buildNewsletterConfirmation,
  buildNewsletterWelcome,
} from '../lib/mail';
import { enqueueMailJob } from '../lib/mail-queue';
import { validateFormTurnstile } from '../lib/turnstile';

const forms = new Hono<{ Bindings: Env; Variables: Variables }>();
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

const requirePermission = (
  claims: AccessTokenPayload | null,
  env: Env,
  permission: AdminPermission,
) => {
  if (env.DEV_AUTH_BYPASS === '1') return null;
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
  const denied = requirePermission(c.get('accessClaims'), c.env, 'forms:read');
  if (denied) return denied;
  const status = c.req.query('status');
  const whereClause = status && allowedStatuses.has(status) ? 'WHERE status = ?' : '';
  const requestedPage = Number.parseInt(c.req.query('page') ?? '', 10);
  const requestedPageSize = Number.parseInt(c.req.query('pageSize') ?? '', 10);
  const paginated = Number.isFinite(requestedPage) || Number.isFinite(requestedPageSize);
  const page = Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1);
  const pageSize = Math.min(100, Math.max(10, Number.isFinite(requestedPageSize) ? requestedPageSize : 25));
  const paginationClause = paginated ? ' LIMIT ? OFFSET ?' : '';
  const query = `SELECT id, form_type, name, email, company, role, website, team_size, industry, timeline, budget, goals, message, status, received_at, ip_address, user_agent FROM lead_submissions ${whereClause} ORDER BY received_at DESC${paginationClause}`;
  const statement = c.env.PLATFORM_DB.prepare(query);
  const values: unknown[] = whereClause ? [status] : [];
  if (paginated) values.push(pageSize, (page - 1) * pageSize);
  const response = values.length ? await statement.bind(...values).all() : await statement.all();
  const rows = Array.isArray(response?.results) ? response.results : [];
  if (c.req.query('format') === 'csv') {
    return new Response(buildCsv(rows as Record<string, unknown>[]), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="lead-submissions.csv"' } });
  }
  if (!paginated) return c.json(rows);
  const countStatement = c.env.PLATFORM_DB.prepare(`SELECT COUNT(*) AS total FROM lead_submissions ${whereClause}`);
  const countRow = whereClause
    ? await countStatement.bind(status).first<{ total: number }>()
    : await countStatement.first<{ total: number }>();
  const total = Number(countRow?.total ?? 0);
  return c.json({ items: rows, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
});

forms.post('/leads', async (c) => {
  if (!isSameOriginRequest(c.req.raw)) return c.text('Forbidden: CSRF check failed', 403);
  const denied = requirePermission(c.get('accessClaims'), c.env, 'forms:write');
  if (denied) return denied;
  const body = await c.req.parseBody();
  const id = String(body.id || '').trim();
  const status = String(body.status || '').trim();
  if (!id || !allowedStatuses.has(status)) return c.text('Invalid request.', 400);
  await c.env.PLATFORM_DB.prepare('UPDATE lead_submissions SET status = ? WHERE id = ?').bind(status, id).run();
  return c.json({ id, status });
});

forms.get('/configs', async (c) => {
  const denied = requirePermission(c.get('accessClaims'), c.env, 'forms:read');
  if (denied) return denied;
  const result = await c.env.PLATFORM_DB.prepare('SELECT id, slug, name, status, fields, recipients, integrations, created_at, updated_at FROM form_configs ORDER BY updated_at DESC').all();
  return c.json({ configs: (result?.results ?? []).map((row) => normalizeRow(row as Record<string, string>)) });
});

forms.post('/configs', async (c) => {
  if (!isSameOriginRequest(c.req.raw)) return c.json({ error: 'Forbidden: CSRF check failed.' }, 403);
  const denied = requirePermission(c.get('accessClaims'), c.env, 'forms:write');
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
  const denied = requirePermission(c.get('accessClaims'), c.env, 'forms:read');
  if (denied) return denied;
  const result = await c.env.PLATFORM_DB.prepare('SELECT id, slug, name, status, fields, recipients, integrations, created_at, updated_at FROM form_configs WHERE slug = ? LIMIT 1').bind(c.req.param('slug')).all();
  const row = result?.results?.[0] as Record<string, string> | undefined;
  return row ? c.json({ config: normalizeRow(row) }) : c.text('Form not found.', 404);
});


type FormsContext = Context<{ Bindings: Env; Variables: Variables }>;

const updateConfig = async (c: FormsContext) => {
  if (!isSameOriginRequest(c.req.raw)) return c.json({ error: 'Forbidden: CSRF check failed.' }, 403);
  const denied = requirePermission(c.get('accessClaims'), c.env, 'forms:write');
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

  // Validate Turnstile token if configured
  const turnstileForm = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') turnstileForm.set(key, value);
  }
  const turnstileValidation = await validateFormTurnstile(
    turnstileForm,
    c.env.TURNSTILE_SECRET,
    c.req.raw,
  );

  if (!turnstileValidation.valid) {
    return c.json(
      { ok: false, error: { message: turnstileValidation.error || 'Turnstile validation failed' } },
      400,
    );
  }

  await c.env.PLATFORM_DB.prepare(`INSERT INTO lead_submissions (id, form_type, name, email, company, role, website, team_size, industry, timeline, budget, goals, message, status, received_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`)
    .bind(id, formId, body.name ?? null, body.email ?? null, body.company ?? null, body.role ?? null, body.website ?? null, body.teamSize ?? null, body.industry ?? null, body.timeline ?? null, body.budget ?? null, body.goals ?? null, body.message ?? null, now, c.req.header('CF-Connecting-IP') ?? null, c.req.header('User-Agent') ?? null).run();

  const configResult = await c.env.PLATFORM_DB.prepare('SELECT recipients FROM form_configs WHERE slug = ? LIMIT 1').bind(formId).all();
  const configRow = configResult?.results?.[0] as Record<string, string> | undefined;
  const configRecipients = parseJson(configRow?.recipients ?? null, [] as Array<{ email?: string; name?: string }>);
  const recipients = parseNotificationRecipients(configRecipients, c.env.CONTACT_NOTIFICATION_EMAILS);

  const notificationResult = recipients.length
    ? await enqueueMailJob(
        c.env,
        {
          to: recipients,
          subject: `[GoldShore] New ${formId} submission`,
          text: [
          `Name: ${name || 'N/A'}`,
          `Email: ${email || 'N/A'}`,
          '',
          message || 'No message provided.',
          ].join('\n'),
          html: `<p><strong>Name:</strong> ${escapeHtml(name || 'N/A')}</p><p><strong>Email:</strong> ${escapeHtml(email || 'N/A')}</p><p>${escapeHtml(message || 'No message provided.').replace(/\n/g, '<br>')}</p>`,
          replyTo: email && isValidEmail(email) ? { email, name } : undefined,
        },
      )
    : { attempted: false, reason: 'no_recipients' };

  const autoResponder = buildLeadAutoResponder({ name, formType: formId });
  const autoResponderResult =
    email && isValidEmail(email)
      ? await enqueueMailJob(c.env, {
          to: [{ email, name }],
          subject: autoResponder.subject,
          text: autoResponder.text,
          html: autoResponder.html,
        })
      : { attempted: false, reason: 'missing_submitter_email' };

  return c.json({ ok: true, status: 'received', formId, submissionId: id, submittedAt: now, redirectTo: String(body.redirectTo || '/contact?submitted=1'), mail: { notification: notificationResult, autoResponder: autoResponderResult } }, 202);
});

export default forms;
