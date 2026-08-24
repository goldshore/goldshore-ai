import { Hono } from 'hono';
import { requirePermission } from '../../auth';
import type { Env, Variables } from '../../types';

const layout = new Hono<{ Bindings: Env; Variables: Variables }>();
const MAX_MODULES = 80;
const MAX_PAGE_LENGTH = 180;
const VALID_DENSITIES = new Set(['compact', 'balanced', 'comfortable']);

type ModulePreference = {
  id: string;
  order?: number;
  width?: number;
  height?: number;
  colSpan?: number;
  hidden?: boolean;
};

type LayoutPreference = {
  version: 1;
  density: 'compact' | 'balanced' | 'comfortable';
  modules: ModulePreference[];
  updatedAt: string;
};

const safePage = (value: string) => value.slice(0, MAX_PAGE_LENGTH).replace(/[^a-zA-Z0-9/_?&=.-]/g, '');
const safeActor = (claims: any) => String(claims?.email || claims?.sub || claims?.id || 'admin').slice(0, 180);
const keyFor = (claims: any, page: string) => `admin-layout:v1:${encodeURIComponent(safeActor(claims))}:${encodeURIComponent(safePage(page))}`;

const normalize = (body: any): LayoutPreference => {
  const modules = Array.isArray(body?.modules) ? body.modules.slice(0, MAX_MODULES).map((item: any, index: number) => ({
    id: String(item?.id || '').slice(0, 100),
    order: Number.isFinite(Number(item?.order)) ? Math.max(0, Math.min(MAX_MODULES - 1, Number(item.order))) : index,
    width: Number.isFinite(Number(item?.width)) ? Math.max(220, Math.min(2400, Number(item.width))) : undefined,
    height: Number.isFinite(Number(item?.height)) ? Math.max(120, Math.min(1800, Number(item.height))) : undefined,
    colSpan: Number.isFinite(Number(item?.colSpan)) ? Math.max(1, Math.min(12, Number(item.colSpan))) : undefined,
    hidden: Boolean(item?.hidden),
  })).filter((item: ModulePreference) => item.id) : [];
  const density = VALID_DENSITIES.has(body?.density) ? body.density : 'balanced';
  return { version: 1, density, modules, updatedAt: new Date().toISOString() };
};

layout.get('/', requirePermission('system:read'), async (c) => {
  const page = safePage(c.req.query('page') || '/admin/overview');
  const claims = c.get('accessClaims');
  const key = keyFor(claims, page);
  const stored = await c.env.KV.get<LayoutPreference>(key, 'json');
  return c.json({
    page,
    preference: stored || { version: 1, density: 'balanced', modules: [], updatedAt: null },
    storage: 'KV',
  });
});

layout.put('/', requirePermission('system:read'), async (c) => {
  const page = safePage(c.req.query('page') || '/admin/overview');
  const claims = c.get('accessClaims');
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Valid JSON preference payload is required.' }, 400);
  const preference = normalize(body);
  await c.env.KV.put(keyFor(claims, page), JSON.stringify(preference));
  return c.json({ success: true, page, preference });
});

layout.delete('/', requirePermission('system:read'), async (c) => {
  const page = safePage(c.req.query('page') || '/admin/overview');
  const claims = c.get('accessClaims');
  await c.env.KV.delete(keyFor(claims, page));
  return c.json({ success: true, page });
});

export default layout;
