import { Hono } from 'hono';
import sanitizeHtml from 'sanitize-html';
import { getActor, logAdminAction, requirePermission } from '../auth';
import type { Env, Variables } from '../types';

const sites = new Hono<{ Bindings: Env; Variables: Variables }>();
const siteIdPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;
const slugPattern = /^(?:[a-z0-9][a-z0-9-]*\/)*[a-z0-9][a-z0-9-]*$|^home$/;
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const frameworks = new Set(['astro', 'static', 'wordpress-import']);
const statuses = new Set(['draft', 'ready', 'archived']);
const pageStatuses = new Set(['draft', 'published']);
export const cleanManagedPageHtml = (value: string) => sanitizeHtml(value, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'span']),
  allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt', 'width', 'height'] },
});

export const SITE_PLUGIN_CATALOG = [
  { id: 'cloudflare-web-analytics', name: 'Cloudflare Web Analytics', category: 'analytics', configKeys: ['token'] },
  { id: 'turnstile', name: 'Cloudflare Turnstile', category: 'security', configKeys: ['siteKey'] },
  { id: 'goldshore-contact-form', name: 'GoldShore Contact Form', category: 'forms', configKeys: ['formSlug'] },
  { id: 'goldshore-newsletter', name: 'GoldShore Newsletter', category: 'email', configKeys: ['listId'] },
  { id: 'google-tag-manager', name: 'Google Tag Manager', category: 'analytics', configKeys: ['containerId'] },
] as const;

const pluginById = new Map(SITE_PLUGIN_CATALOG.map((plugin) => [plugin.id, plugin]));
export const normalizeManagedDomain = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized)) return null;
  if (normalized === 'localhost' || normalized.endsWith('.local')) return null;
  return normalized;
};
const json = (value: string | null | undefined, fallback: unknown = {}) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const audit = (c: any, action: string, metadata: Record<string, unknown>) => logAdminAction(c.env, { action, actor: getActor(c.get('accessClaims'), c.req.raw), status: 'success', metadata });
const exists = async (db: D1Database, id: string) => Boolean(await db.prepare('SELECT id FROM managed_sites WHERE id=?').bind(id).first());

sites.get('/plugins/catalog', requirePermission('system:read'), (c) => c.json({ plugins: SITE_PLUGIN_CATALOG }));

sites.get('/', requirePermission('system:read'), async (c) => {
  const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(c.req.query('pageSize') ?? '20', 10) || 20));
  const status = c.req.query('status'); const where = status && statuses.has(status) ? 'WHERE status=?' : ''; const values = where ? [status] : [];
  const rows = await c.env.PLATFORM_DB.prepare(`SELECT id,name,domain,framework,status,repository,created_by,created_at,updated_at FROM managed_sites ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).bind(...values, pageSize, (page - 1) * pageSize).all();
  const count = await c.env.PLATFORM_DB.prepare(`SELECT COUNT(*) total FROM managed_sites ${where}`).bind(...values).first<{ total: number }>(); const total = Number(count?.total ?? 0);
  return c.json({ items: rows.results, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
});

sites.post('/', requirePermission('system:write'), async (c) => {
  const body = await c.req.json<{ id?: string; name?: string; domain?: string; framework?: string; repository?: string }>().catch(() => null);
  const id = body?.id?.trim().toLowerCase() ?? ''; const name = body?.name?.trim() ?? ''; const domain = normalizeManagedDomain(body?.domain); const framework = body?.framework ?? '';
  if (!siteIdPattern.test(id) || !name || name.length > 100 || !domain || !frameworks.has(framework) || (body?.repository && !repositoryPattern.test(body.repository))) return c.json({ error: 'Valid site ID, name, public domain, framework, and optional owner/repository are required.' }, 400);
  try { await c.env.PLATFORM_DB.prepare("INSERT INTO managed_sites(id,name,domain,framework,repository,created_by) VALUES(?,?,?,?,?,?)").bind(id, name, domain, framework, body?.repository?.trim() || null, getActor(c.get('accessClaims'), c.req.raw)).run(); }
  catch { return c.json({ error: 'Site ID or domain already exists.' }, 409); }
  await audit(c, 'site.create', { siteId: id, domain, framework }); return c.json({ id, name, domain, framework, status: 'draft' }, 201);
});

sites.get('/:siteId', requirePermission('system:read'), async (c) => {
  const id = c.req.param('siteId'); if (!siteIdPattern.test(id)) return c.json({ error: 'Invalid site ID.' }, 400);
  const site = await c.env.PLATFORM_DB.prepare('SELECT id,name,domain,framework,status,repository,created_by,created_at,updated_at FROM managed_sites WHERE id=?').bind(id).first(); if (!site) return c.json({ error: 'Site not found.' }, 404);
  const [pages, plugins, builds] = await Promise.all([
    c.env.PLATFORM_DB.prepare('SELECT id,slug,title,status,created_at,updated_at FROM managed_site_pages WHERE site_id=? ORDER BY updated_at DESC').bind(id).all(),
    c.env.PLATFORM_DB.prepare('SELECT plugin_id,config_json,installed_by,installed_at FROM managed_site_plugins WHERE site_id=? ORDER BY installed_at DESC').bind(id).all<any>(),
    c.env.PLATFORM_DB.prepare('SELECT id,status,plan_json,requested_by,created_at FROM managed_site_builds WHERE site_id=? ORDER BY created_at DESC LIMIT 20').bind(id).all<any>(),
  ]);
  return c.json({ site, pages: pages.results, plugins: plugins.results.map((row) => ({ ...row, config: json(row.config_json), config_json: undefined })), builds: builds.results.map((row) => ({ ...row, plan: json(row.plan_json), plan_json: undefined })) });
});

sites.patch('/:siteId', requirePermission('system:write'), async (c) => {
  const id = c.req.param('siteId'); const body = await c.req.json<{ name?: string; status?: string; repository?: string | null }>().catch(() => null);
  if (!siteIdPattern.test(id) || !body) return c.json({ error: 'Invalid site update.' }, 400);
  const fields: string[] = []; const values: unknown[] = [];
  if (body.name !== undefined) { const name = body.name.trim(); if (!name || name.length > 100) return c.json({ error: 'Invalid site name.' }, 400); fields.push('name=?'); values.push(name); }
  if (body.status !== undefined) { if (!statuses.has(body.status)) return c.json({ error: 'Invalid site status.' }, 400); fields.push('status=?'); values.push(body.status); }
  if (body.repository !== undefined) { if (body.repository && !repositoryPattern.test(body.repository)) return c.json({ error: 'Repository must use owner/repository format.' }, 400); fields.push('repository=?'); values.push(body.repository || null); }
  if (!fields.length) return c.json({ error: 'No supported fields supplied.' }, 400);
  const result = await c.env.PLATFORM_DB.prepare(`UPDATE managed_sites SET ${fields.join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...values, id).run(); if (!result.meta.changes) return c.json({ error: 'Site not found.' }, 404);
  await audit(c, 'site.update', { siteId: id, fields }); return c.json({ success: true });
});

sites.post('/:siteId/pages', requirePermission('content:write'), async (c) => {
  const siteId = c.req.param('siteId'); const body = await c.req.json<{ slug?: string; title?: string; bodyHtml?: string; status?: string }>().catch(() => null); const slug = body?.slug?.trim().toLowerCase().replace(/^\/+|\/+$/g, '') || 'home';
  if (!siteIdPattern.test(siteId) || !(await exists(c.env.PLATFORM_DB, siteId))) return c.json({ error: 'Site not found.' }, 404);
  if (!slugPattern.test(slug) || !body?.title?.trim() || body.title.length > 160 || (body.bodyHtml?.length ?? 0) > 250_000 || !pageStatuses.has(body.status ?? 'draft')) return c.json({ error: 'Valid slug, title, HTML body, and page status are required.' }, 400);
  const id = crypto.randomUUID(); try { await c.env.PLATFORM_DB.prepare('INSERT INTO managed_site_pages(id,site_id,slug,title,body_html,status) VALUES(?,?,?,?,?,?)').bind(id, siteId, slug, body.title.trim(), cleanManagedPageHtml(body.bodyHtml ?? ''), body.status ?? 'draft').run(); } catch { return c.json({ error: 'That page slug already exists for this site.' }, 409); }
  await audit(c, 'site.page.create', { siteId, pageId: id, slug }); return c.json({ id, siteId, slug, title: body.title.trim(), status: body.status ?? 'draft' }, 201);
});

sites.get('/:siteId/pages/:pageId', requirePermission('content:read'), async (c) => {
  const page = await c.env.PLATFORM_DB.prepare('SELECT id,site_id,slug,title,body_html,status,created_at,updated_at FROM managed_site_pages WHERE site_id=? AND id=?').bind(c.req.param('siteId'), c.req.param('pageId')).first(); return page ? c.json({ page }) : c.json({ error: 'Page not found.' }, 404);
});

sites.put('/:siteId/pages/:pageId', requirePermission('content:write'), async (c) => {
  const body = await c.req.json<{ title?: string; bodyHtml?: string; status?: string }>().catch(() => null); if (!body?.title?.trim() || body.title.length > 160 || (body.bodyHtml?.length ?? 0) > 250_000 || !pageStatuses.has(body.status ?? 'draft')) return c.json({ error: 'Valid title, HTML body, and status are required.' }, 400);
  const result = await c.env.PLATFORM_DB.prepare('UPDATE managed_site_pages SET title=?,body_html=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE site_id=? AND id=?').bind(body.title.trim(), cleanManagedPageHtml(body.bodyHtml ?? ''), body.status ?? 'draft', c.req.param('siteId'), c.req.param('pageId')).run(); if (!result.meta.changes) return c.json({ error: 'Page not found.' }, 404);
  await audit(c, 'site.page.update', { siteId: c.req.param('siteId'), pageId: c.req.param('pageId') }); return c.json({ success: true });
});

sites.post('/:siteId/plugins', requirePermission('system:write'), async (c) => {
  const siteId = c.req.param('siteId'); const body = await c.req.json<{ pluginId?: string; config?: Record<string, unknown>; confirm?: boolean }>().catch(() => null); const plugin = body?.pluginId ? pluginById.get(body.pluginId) : undefined;
  if (!body?.confirm) return c.json({ error: 'Explicit confirmation is required.' }, 409); if (!plugin || !(await exists(c.env.PLATFORM_DB, siteId))) return c.json({ error: 'Known plugin and site are required.' }, 400);
  const config = body.config ?? {}; if (Object.keys(config).some((key) => !plugin.configKeys.includes(key as never)) || JSON.stringify(config).length > 8_192) return c.json({ error: 'Plugin configuration contains unsupported fields.' }, 400);
  await c.env.PLATFORM_DB.prepare('INSERT INTO managed_site_plugins(site_id,plugin_id,config_json,installed_by) VALUES(?,?,?,?) ON CONFLICT(site_id,plugin_id) DO UPDATE SET config_json=excluded.config_json,installed_by=excluded.installed_by,installed_at=CURRENT_TIMESTAMP').bind(siteId, plugin.id, JSON.stringify(config), getActor(c.get('accessClaims'), c.req.raw)).run();
  await audit(c, 'site.plugin.install', { siteId, pluginId: plugin.id }); return c.json({ success: true, plugin: { ...plugin, config } }, 201);
});

sites.delete('/:siteId/plugins/:pluginId', requirePermission('system:write'), async (c) => {
  if (c.req.query('confirm') !== 'true') return c.json({ error: 'Explicit confirmation is required.' }, 409); const result = await c.env.PLATFORM_DB.prepare('DELETE FROM managed_site_plugins WHERE site_id=? AND plugin_id=?').bind(c.req.param('siteId'), c.req.param('pluginId')).run(); if (!result.meta.changes) return c.json({ error: 'Installed plugin not found.' }, 404);
  await audit(c, 'site.plugin.remove', { siteId: c.req.param('siteId'), pluginId: c.req.param('pluginId') }); return c.body(null, 204);
});

sites.post('/:siteId/builds/plan', requirePermission('system:write'), async (c) => {
  const siteId = c.req.param('siteId'); const site = await c.env.PLATFORM_DB.prepare('SELECT id,domain,framework,repository,status FROM managed_sites WHERE id=?').bind(siteId).first<any>(); if (!site) return c.json({ error: 'Site not found.' }, 404);
  const counts = await c.env.PLATFORM_DB.prepare("SELECT COUNT(*) pages,SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) published FROM managed_site_pages WHERE site_id=?").bind(siteId).first<any>(); const plugins = await c.env.PLATFORM_DB.prepare('SELECT plugin_id FROM managed_site_plugins WHERE site_id=? ORDER BY plugin_id').bind(siteId).all<any>();
  const plan = { mode: 'dry-run', deployableApp: 'apps/gs-web', domain: site.domain, framework: site.framework, repository: site.repository, pages: Number(counts?.pages ?? 0), publishedPages: Number(counts?.published ?? 0), plugins: plugins.results.map((row) => row.plugin_id), checks: ['pnpm --filter @goldshore/gs-web build', 'pnpm validate', 'review Cloudflare route ownership', 'open a draft PR before deployment'] };
  const id = crypto.randomUUID(); await c.env.PLATFORM_DB.prepare("INSERT INTO managed_site_builds(id,site_id,status,plan_json,requested_by) VALUES(?,?,'planned',?,?)").bind(id, siteId, JSON.stringify(plan), getActor(c.get('accessClaims'), c.req.raw)).run(); await audit(c, 'site.build.plan', { siteId, buildId: id }); return c.json({ id, status: 'planned', plan }, 201);
});

export default sites;
