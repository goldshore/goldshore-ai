import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

export const GET: APIRoute = ({ request, locals }) =>
  proxyApiRequest(request, '/v1/forms/leads', locals.PUBLIC_API);
