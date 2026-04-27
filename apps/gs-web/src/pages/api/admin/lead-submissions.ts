import type { APIRoute } from 'astro';

const allowedStatuses = new Set(['new', 'read', 'archived']);

const escapeCsvValue = (value: unknown) => {
  const normalized = value === null || value === undefined ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
};

const buildCsv = (rows: Record<string, unknown>[]) => {
  const columns = [
    'id',
    'form_type',
    'name',
    'email',
    'company',
    'role',
    'website',
    'team_size',
    'industry',
    'timeline',
    'budget',
    'goals',
    'message',
    'status',
    'received_at',
    'ip_address',
    'user_agent',
  ];

  const header = columns.map(escapeCsvValue).join(',');
  const body = rows.map((row) => columns.map((col) => escapeCsvValue(row[col])).join(','));
  return [header, ...body].join('\n');
};

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.DB) {
    return new Response('Storage unavailable.', { status: 503 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format');
  const status = url.searchParams.get('status');

  const whereClause = status && allowedStatuses.has(status) ? 'WHERE status = ?' : '';
  const query = `SELECT
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
    user_agent
  FROM lead_submissions
  ${whereClause}
  ORDER BY received_at DESC`;

  const statement = env.DB.prepare(query);
  const response = whereClause ? await statement.bind(status).all() : await statement.all();
  const rows = Array.isArray(response?.results) ? response.results : [];

  if (format === 'csv') {
    const csv = buildCsv(rows);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="lead-submissions.csv"',
      },
    });
  }

  return new Response(JSON.stringify(rows), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.DB) {
    return new Response('Storage unavailable.', { status: 503 });
  }

  const contentType = request.headers.get('content-type') || '';
  let id = '';
  let status = '';
  let redirectTo = '';

  if (contentType.includes('application/json')) {
    const body = (await request.json()) as { id?: string; status?: string; redirectTo?: string };
    id = body?.id?.trim() ?? '';
    status = body?.status?.trim() ?? '';
    redirectTo = body?.redirectTo?.trim() ?? '';
  } else if (contentType.includes('form')) {
    const formData = await request.formData();
    id = String(formData.get('id') || '').trim();
    status = String(formData.get('status') || '').trim();
    redirectTo = String(formData.get('redirectTo') || '').trim();
  }

  if (!id || !allowedStatuses.has(status)) {
    return new Response('Invalid request.', { status: 400 });
  }

  await env.DB.prepare('UPDATE lead_submissions SET status = ? WHERE id = ?').bind(status, id).run();

  if (redirectTo && redirectTo.startsWith('/')) {
    return Response.redirect(redirectTo, 303);
  }

  return new Response(JSON.stringify({ id, status }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
};
