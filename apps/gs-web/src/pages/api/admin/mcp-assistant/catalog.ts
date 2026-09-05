import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../lib/api-proxy';

export const GET: APIRoute = ({ request, locals }) =>
  proxyAdminRequest(request, '/admin/mcp-assistant/catalog', locals.PUBLIC_API);

