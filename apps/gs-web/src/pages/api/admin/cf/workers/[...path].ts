import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../../lib/api-proxy';

const proxy: APIRoute = ({ request, locals, params }) =>
  proxyApiRequest(request, `/system/cf/workers/${params.path ?? ''}`, locals.PUBLIC_API);

export const PUT = proxy;
export const DELETE = proxy;
