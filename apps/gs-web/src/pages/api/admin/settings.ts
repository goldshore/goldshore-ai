import type { APIRoute } from 'astro';
import {
  buildAdminSession,
  verifyAccessWithClaims,
  type Env as AccessEnv,
} from '@goldshore/auth';

export const prerender = false;

type SiteSettings = {
  apiUrl: string;
  contactNotificationEmails: string;
  llmProvider: string;
  riskRadarEnabled: boolean;
  briefingFormEnabled: boolean;
  maintenanceMode: boolean;
  analyticsEnabled: boolean;
  updatedAt: string;
};

const DEFAULTS: Omit<SiteSettings, 'updatedAt'> = {
  apiUrl: 'https://api.goldshore.ai',
  contactNotificationEmails: '',
  llmProvider: 'claude',
  riskRadarEnabled: true,
  briefingFormEnabled: true,
  maintenanceMode: false,
  analyticsEnabled: true,
};

const getSettings = async (env: Env): Promise<SiteSettings> => {
  const stored = await env.KV?.get('ADMIN_SITE_SETTINGS', 'json');
  return {
    ...DEFAULTS,
    ...(stored as Partial<SiteSettings> | null),
    updatedAt: (stored as Partial<SiteSettings> | null)?.updatedAt ?? new Date().toISOString(),
  };
};

const hasPermission = async (
  request: Request,
  env: AccessEnv & Env,
  permission: 'system:read' | 'system:write',
) => {
  const claims = await verifyAccessWithClaims(request, env);
  if (!claims) return false;
  const session = buildAdminSession(claims);
  return session.permissions.includes(permission);
};

const isSameOriginRequest = (request: Request) => {
  const expectedOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get('origin');
  if (originHeader) return originHeader === expectedOrigin;
  const referer = request.headers.get('referer');
  if (referer) {
    try { return new URL(referer).origin === expectedOrigin; } catch { return false; }
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'none';
  return false;
};

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.KV) return new Response('Storage unavailable.', { status: 503 });

  const ok = await hasPermission(request, env as never, 'system:read');
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const settings = await getSettings(env);
  return Response.json({ success: true, settings });
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.KV) return new Response('Storage unavailable.', { status: 503 });

  if (!isSameOriginRequest(request)) return new Response('Forbidden: CSRF check failed.', { status: 403 });

  const ok = await hasPermission(request, env as never, 'system:write');
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const body = await request.json() as Partial<SiteSettings>;

  const current = await getSettings(env);
  const next: SiteSettings = {
    ...current,
    ...body,
    updatedAt: new Date().toISOString(),
  };

  // Strip updatedAt from body to prevent injection
  delete (next as Record<string, unknown>).id;

  await env.KV.put('ADMIN_SITE_SETTINGS', JSON.stringify(next));
  return Response.json({ success: true, settings: next });
};

export const PATCH = PUT;
