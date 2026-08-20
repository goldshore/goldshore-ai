import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../lib/api-proxy';

export const POST: APIRoute = ({ request, locals }) => proxyAdminRequest(request, '/admin/email/send', locals.PUBLIC_API);
