import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../lib/api-proxy';

const forward: APIRoute = ({ request, locals, params }) =>
  proxyAdminRequest(request, `/admin/entries${params.path ? `/${params.path}` : ''}`, locals.PUBLIC_API);

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
