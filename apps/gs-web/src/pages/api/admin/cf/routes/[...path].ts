import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../../lib/api-proxy';

const proxy: APIRoute = ({ request, locals, params }) =>
  proxyAdminRequest(request, `/system/cf/routes${params.path ? `/${params.path}` : ''}`, locals.PUBLIC_API);

export const POST = proxy;
export const DELETE = proxy;
