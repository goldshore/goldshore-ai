import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../../lib/api-proxy';

const proxy: APIRoute = ({ request, locals, params }) =>
  proxyApiRequest(request, `/system/cf/routes${params.path ? `/${params.path}` : ''}`, locals.PUBLIC_API);

export const POST = proxy;
export const DELETE = proxy;
