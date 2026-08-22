import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../lib/api-proxy';

export const POST: APIRoute = ({ request, locals }) =>
  proxyAdminRequest(request, '/admin/mcp-assistant/search', locals.PUBLIC_API);

