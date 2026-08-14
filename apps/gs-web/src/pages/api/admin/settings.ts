import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

export const GET: APIRoute = ({ request, locals }) => proxyApiRequest(request, '/admin/settings', locals.PUBLIC_API);
export const PUT: APIRoute = ({ request, locals }) => proxyApiRequest(request, '/admin/settings', locals.PUBLIC_API);
