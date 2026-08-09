import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

const forward: APIRoute = ({ request, params, locals }) =>
  proxyApiRequest(request, `/v1/forms/configs/${encodeURIComponent(params.slug || '')}`, locals.PUBLIC_API);

export const GET = forward;
export const PUT = forward;
export const PATCH = forward;
