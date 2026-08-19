import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../lib/api-proxy';

const forward: APIRoute = ({ request, locals, params }) =>
  proxyApiRequest(request, `/admin/email${params.path ? `/${params.path}` : ''}`, locals.PUBLIC_API);

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;
export const PATCH = forward;
