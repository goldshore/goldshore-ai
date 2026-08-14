import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../lib/api-proxy';
export const GET: APIRoute = ({ request, locals }) => proxyApiRequest(request, '/system/cf/workers', locals.PUBLIC_API);
