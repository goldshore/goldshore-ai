import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

// Storage diagnostics execute in gs-api, which exclusively owns D1 and R2.
// This endpoint forwards only health metadata and never binding credentials.
export const GET: APIRoute = ({ request, locals }) =>
  proxyApiRequest(request, '/health?type=deep', locals.PUBLIC_API);
