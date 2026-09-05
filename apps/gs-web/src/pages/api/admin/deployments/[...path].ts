import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../lib/api-proxy';

const forward: APIRoute = ({ request, locals, params }) =>
  proxyAdminRequest(request, `/v1/deployments${params.path ? `/${params.path}` : ''}`, locals.PUBLIC_API);

export const GET = forward;
export const POST = forward;
