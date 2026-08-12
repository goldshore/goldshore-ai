import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

export const GET: APIRoute = ({ request, locals }) => proxyApiRequest(request, '/v1/forms/configs', locals.PUBLIC_API);
export const POST: APIRoute = ({ request, locals }) => proxyApiRequest(request, '/v1/forms/configs', locals.PUBLIC_API);
