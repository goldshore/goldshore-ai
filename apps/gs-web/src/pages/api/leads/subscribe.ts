import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

export const POST: APIRoute = ({ request, locals }) =>
  proxyApiRequest(request, '/v1/forms/newsletter/submissions', locals.PUBLIC_API);
