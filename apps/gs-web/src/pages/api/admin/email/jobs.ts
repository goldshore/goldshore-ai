import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../lib/api-proxy';

export const GET: APIRoute = ({ request, locals }) => proxyApiRequest(request, '/admin/email/jobs', locals.PUBLIC_API);
