import { Hono } from 'hono';
import { requirePermission } from '../auth';
import { Env, Variables } from '../types';

type PageRow = {
  id: number;
  slug: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const allowedStatuses = new Set(['draft', 'published', 'disabled']);

const normalizePage = (row: PageRow) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  body: row.body,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const pages = new Hono<{ Bindings: Env; Variables: Variables }>();

pages.get('/', requirePermission('content:read'), async (c) => {
  const status = c.req.query('status');
  const query = status
    ? c.env.DB.prepare('SELECT * FROM pages WHERE status = ? ORDER BY updated_at DESC').bind(status)
    : c.env.DB.prepare('SELECT * FROM pages ORDER BY updated_at DESC');
  const result = await query.all<PageRow>();
  return c.json({
    pages: result.results.map(normalizePage)
  });
});

pages.get('/slug/:slug', requirePermission('content:read'), async (c) => {
  const slug = c.req.param('slug');
  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE slug = ? LIMIT 1')
    .bind(slug)
    .first<PageRow>();

  if (!page) {
    return c.json({ error: 'Page not found' }, 404);
  }

  return c.json(normalizePage(page));
});

pages.get('/:id', requirePermission('content:read'), async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return c.json({ error: 'Invalid page id' }, 400);
  }

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ? LIMIT 1')
    .bind(id)
    .first<PageRow>();

  if (!page) {
    return c.json({ error: 'Page not found' }, 404);
  }

  return c.json(normalizePage(page));
});

pages.post('/', requirePermission('content:write'), async (c) => {
  const payload = await c.req.json().catch(() => null) as
    | { slug?: string; title?: string; body?: string; status?: string }
    | null;

  if (!payload?.slug || !payload?.title || !payload?.body) {
    return c.json({ error: 'slug, title, and body are required' }, 400);
  }

  const status = allowedStatuses.has(payload.status ?? '') ? payload.status! : 'draft';

  const insertResult = await c.env.DB.prepare(
    'INSERT INTO pages (slug, title, body, status) VALUES (?, ?, ?, ?)'
  )
    .bind(payload.slug, payload.title, payload.body, status)
    .run();

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ? LIMIT 1')
    .bind(insertResult.meta.last_row_id)
    .first<PageRow>();

  return c.json(page ? normalizePage(page) : { error: 'Page not found after insert' }, page ? 201 : 500);
});

pages.put('/:id', requirePermission('content:write'), async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return c.json({ error: 'Invalid page id' }, 400);
  }

  const payload = await c.req.json().catch(() => null) as
    | { slug?: string; title?: string; body?: string; status?: string }
    | null;

  if (!payload?.slug || !payload?.title || !payload?.body) {
    return c.json({ error: 'slug, title, and body are required' }, 400);
  }

  const status = allowedStatuses.has(payload.status ?? '') ? payload.status! : 'draft';

  const result = await c.env.DB.prepare(
    'UPDATE pages SET slug = ?, title = ?, body = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?'
  )
    .bind(payload.slug, payload.title, payload.body, status, id)
    .run();

  if (!result.meta.changes) {
    return c.json({ error: 'Page not found' }, 404);
  }

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ? LIMIT 1')
    .bind(id)
    .first<PageRow>();

  return c.json(page ? normalizePage(page) : { error: 'Page not found' }, page ? 200 : 404);
});

pages.patch('/:id/status', requirePermission('content:publish'), async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return c.json({ error: 'Invalid page id' }, 400);
  }

  const payload = await c.req.json().catch(() => null) as { status?: string } | null;
  const status = payload?.status;
  if (!status || !allowedStatuses.has(status)) {
    return c.json({ error: 'Invalid status value' }, 400);
  }

  const result = await c.env.DB.prepare(
    'UPDATE pages SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
  )
    .bind(status, id)
    .run();

  if (!result.meta.changes) {
    return c.json({ error: 'Page not found' }, 404);
  }

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ? LIMIT 1')
    .bind(id)
    .first<PageRow>();

  return c.json(page ? normalizePage(page) : { error: 'Page not found' }, page ? 200 : 404);
});

pages.delete('/:id', requirePermission('content:write'), async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return c.json({ error: 'Invalid page id' }, 400);
  }

  const result = await c.env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(id).run();

  if (!result.meta.changes) {
    return c.json({ error: 'Page not found' }, 404);
  }

  return c.json({ ok: true });
});

export default pages;
