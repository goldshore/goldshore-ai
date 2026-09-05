import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../lib/api-proxy';

export const GET: APIRoute = ({ request, locals }) => {
  return proxyAdminRequest(request, '/admin/lead-submissions', locals.PUBLIC_API);
};

export const POST: APIRoute = ({ request, locals }) => {
  return proxyAdminRequest(request, '/admin/lead-submissions', locals.PUBLIC_API);
};
