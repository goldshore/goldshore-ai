import { Hono } from 'hono';
import sanitizeHtml from 'sanitize-html';
import { requirePermission } from '../auth';
import { Env, Variables } from '../types';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'span']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'width', 'height']
  }
};

type PageRow = {
  id: string;
  site_id: string;
  slug: string;
  title: string;
  content: string | null;
  meta_json: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const allowedStatuses = new Set(['draft', 'published', 'disabled']);

const normalizePage = (row: PageRow) => ({
  id: row.id,
  siteId: row.site_id,
  slug: row.slug,
  title: row.title,
  content: row.content ?? '',
  metadata: row.meta_json ? JSON.parse(row.meta_json) : {},
  status: row.status,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const pages = new Hono<{ Bindings: Env; Variables: Variables }>();

pages.get('/', requirePermission('content:read'), async (c) => {
  const status = c.req.query('status');
  const query = status
    ? c.env.PLATFORM_DB.prepare('SELECT * FROM pages WHERE status = ? ORDER BY updated_at DESC').bind(status)
    : c.env.PLATFORM_DB.prepare('SELECT * FROM pages ORDER BY updated_at DESC');
  const result = await query.all<PageRow>();
  return c.json({
    pages: result.results.map(normalizePage)
  });
});

pages.get('/slug/:slug', requirePermission('content:read'), async (c) => {
  const slug = c.req.param('slug');
  const page = await c.env.PLATFORM_DB.prepare('SELECT * FROM pages WHERE slug = ? LIMIT 1')
    .bind(slug)
    .first<PageRow>();

  if (!page) {
    return c.json({ error: 'Page not found' }, 404);
  }

  return c.json(normalizePage(page));
});

pages.get('/:id', requirePermission('content:read'), async (c) => {
  const id = c.req.param('id');

  const page = await c.env.PLATFORM_DB.prepare('SELECT * FROM pages WHERE id = ? LIMIT 1')
    .bind(id)
    .first<PageRow>();

  if (!page) {
    return c.json({ error: 'Page not found' }, 404);
  }

  return c.json(normalizePage(page));
});

pages.post('/', requirePermission('content:write'), async (c) => {
  const payload = await c.req.json().catch(() => null) as
    | { siteId?: string; slug?: string; title?: string; content?: string; body?: string; status?: string; metadata?: Record<string, unknown> }
    | null;

  if (!payload?.slug || !payload?.title) {
    return c.json({ error: 'slug and title are required' }, 400);
  }

  const status = allowedStatuses.has(payload.status ?? '') ? payload.status! : 'draft';
  const sanitizedContent = sanitizeHtml(payload.content ?? payload.body ?? '', SANITIZE_OPTIONS);

  const page = await c.env.PLATFORM_DB.prepare(
    `INSERT INTO pages (id, site_id, slug, title, content, meta_json, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN datetime('now') ELSE NULL END) RETURNING *`
  )
    .bind(crypto.randomUUID(), payload.siteId ?? 'goldshore', payload.slug, payload.title, sanitizedContent, JSON.stringify(payload.metadata ?? {}), status, status)
    .first<PageRow>();

  return c.json(page ? normalizePage(page) : { error: 'Page not found after insert' }, page ? 201 : 500);
});

pages.put('/:id', requirePermission('content:write'), async (c) => {
  const id = c.req.param('id');

  const payload = await c.req.json().catch(() => null) as
    | { siteId?: string; slug?: string; title?: string; content?: string; body?: string; status?: string; metadata?: Record<string, unknown> }
    | null;

  if (!payload?.slug || !payload?.title) {
    return c.json({ error: 'slug and title are required' }, 400);
  }

  const status = allowedStatuses.has(payload.status ?? '') ? payload.status! : 'draft';
  const sanitizedContent = sanitizeHtml(payload.content ?? payload.body ?? '', SANITIZE_OPTIONS);

  const page = await c.env.PLATFORM_DB.prepare(
    `UPDATE pages SET site_id = ?, slug = ?, title = ?, content = ?, meta_json = ?, status = ?,
     published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, datetime('now')) ELSE NULL END,
     updated_at = datetime('now') WHERE id = ? RETURNING *`
  )
    .bind(payload.siteId ?? 'goldshore', payload.slug, payload.title, sanitizedContent, JSON.stringify(payload.metadata ?? {}), status, status, id)
    .first<PageRow>();

  return c.json(page ? normalizePage(page) : { error: 'Page not found' }, page ? 200 : 404);
});

pages.patch('/:id/status', requirePermission('content:publish'), async (c) => {
  const id = c.req.param('id');

  const payload = await c.req.json().catch(() => null) as { status?: string } | null;
  const status = payload?.status;
  if (!status || !allowedStatuses.has(status)) {
    return c.json({ error: 'Invalid status value' }, 400);
  }

  const page = await c.env.PLATFORM_DB.prepare(
    `UPDATE pages SET status = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, datetime('now')) ELSE NULL END,
     updated_at = datetime('now') WHERE id = ? RETURNING *`
  )
    .bind(status, status, id)
    .first<PageRow>();

  return c.json(page ? normalizePage(page) : { error: 'Page not found' }, page ? 200 : 404);
});

pages.delete('/:id', requirePermission('content:write'), async (c) => {
  const id = c.req.param('id');

  const result = await c.env.PLATFORM_DB.prepare('DELETE FROM pages WHERE id = ?').bind(id).run();

  if (!result.meta.changes) {
    return c.json({ error: 'Page not found' }, 404);
  }

  return c.json({ ok: true });
});

export default pages;
