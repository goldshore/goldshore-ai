import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../lib/api-proxy';

export const POST: APIRoute = ({ request, locals }) =>
  proxyApiRequest(request, '/admin/mcp-assistant/search', locals.PUBLIC_API);

