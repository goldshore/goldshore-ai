import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

export const GET: APIRoute = ({ request, locals }) => {
  console.error('[settings.ts] GET /admin/settings | hasAdminSession:', !!locals.adminSession);
  return proxyApiRequest(request, '/admin/settings', locals.PUBLIC_API);
};

export const PUT: APIRoute = ({ request, locals }) => {
  console.error('[settings.ts] PUT /admin/settings | hasAdminSession:', !!locals.adminSession);
  return proxyApiRequest(request, '/admin/settings', locals.PUBLIC_API);
};
