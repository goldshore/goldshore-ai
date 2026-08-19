import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../lib/api-proxy';

export const GET: APIRoute = ({ request, locals }) =>
  proxyApiRequest(request, '/admin/email/templates', locals.PUBLIC_API);

export const POST: APIRoute = ({ request, locals }) =>
  proxyApiRequest(request, '/admin/email/templates', locals.PUBLIC_API);
