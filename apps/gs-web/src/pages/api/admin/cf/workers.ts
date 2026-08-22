import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../lib/api-proxy';
export const GET: APIRoute = ({ request, locals }) => proxyAdminRequest(request, '/system/cf/workers', locals.PUBLIC_API);
