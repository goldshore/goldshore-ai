import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../lib/api-proxy';

export const GET: APIRoute = ({ request, locals }) =>
  proxyApiRequest(request, '/admin/mcp-assistant/catalog', locals.PUBLIC_API);

