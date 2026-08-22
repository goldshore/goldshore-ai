import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../lib/api-proxy';

export const GET: APIRoute = ({ request, locals }) => {
  console.error('[settings.ts] GET /admin/settings | hasAdminSession:', !!locals.adminSession);
  return proxyAdminRequest(request, '/admin/settings', locals.PUBLIC_API);
};

export const PUT: APIRoute = ({ request, locals }) => {
  console.error('[settings.ts] PUT /admin/settings | hasAdminSession:', !!locals.adminSession);
  return proxyAdminRequest(request, '/admin/settings', locals.PUBLIC_API);
};
