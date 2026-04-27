import type { APIRoute } from 'astro';

export const prerender = false;

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizeRow = (row: Record<string, string>) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  status: row.status,
  fields: parseJson(row.fields ?? null, [] as Record<string, unknown>[]),
  recipients: parseJson(row.recipients ?? null, [] as Record<string, unknown>[]),
  integrations: parseJson(row.integrations ?? null, [] as Record<string, unknown>[]),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const GET: APIRoute = async ({ locals, params }) => {
  const env = locals.runtime?.env as Env | undefined;
  const slug = params.slug;

  if (!env?.DB) {
    return new Response('Storage unavailable.', { status: 503 });
  }

  if (!slug) {
    return new Response('Form slug is required.', { status: 400 });
  }

  const result = await env.DB.prepare(
    `SELECT id, slug, name, status, fields, recipients, integrations, created_at, updated_at
     FROM form_configs
     WHERE slug = ?
     LIMIT 1`
  )
    .bind(slug)
    .all();

  const row = result?.results?.[0] as Record<string, string> | undefined;
  if (!row) {
    return new Response('Form not found.', { status: 404 });
  }

  return Response.json({ config: normalizeRow(row) });
};

export const PUT: APIRoute = async ({ request, locals, params }) => {
  const env = locals.runtime?.env as Env | undefined;
  const slug = params.slug;

  if (!env?.DB) {
    return new Response('Storage unavailable.', { status: 503 });
  }

  if (!slug) {
    return new Response('Form slug is required.', { status: 400 });
  }

  const payload = (await request.json()) as {
    name?: string;
    status?: string;
    fields?: Record<string, unknown>[];
    recipients?: Record<string, unknown>[];
    integrations?: Record<string, unknown>[];
  };

  const existing = await env.DB.prepare(
    `SELECT id, slug, name, status, fields, recipients, integrations, created_at, updated_at
     FROM form_configs
     WHERE slug = ?
     LIMIT 1`
  )
    .bind(slug)
    .all();

  const row = existing?.results?.[0] as Record<string, string> | undefined;
  if (!row) {
    return new Response('Form not found.', { status: 404 });
  }

  const updated = {
    name: payload.name ?? row.name,
    status: payload.status ?? row.status,
    fields: payload.fields ?? parseJson(row.fields ?? null, [] as Record<string, unknown>[]),
    recipients: payload.recipients ?? parseJson(row.recipients ?? null, [] as Record<string, unknown>[]),
    integrations: payload.integrations ?? parseJson(row.integrations ?? null, [] as Record<string, unknown>[])
  };

  const now = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE form_configs
     SET name = ?, status = ?, fields = ?, recipients = ?, integrations = ?, updated_at = ?
     WHERE slug = ?`
  )
    .bind(
      updated.name,
      updated.status,
      JSON.stringify(updated.fields),
      JSON.stringify(updated.recipients),
      JSON.stringify(updated.integrations),
      now,
      slug
    )
    .run();

  return Response.json({
    config: {
      id: row.id,
      slug,
      name: updated.name,
      status: updated.status,
      fields: updated.fields,
      recipients: updated.recipients,
      integrations: updated.integrations,
      createdAt: row.created_at,
      updatedAt: now
    }
  });
};

export const PATCH = PUT;

export const getStaticPaths = async () => [];
