import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../lib/api-proxy';

const proxy = (request: Request, publicApi?: string) => {
  const url = new URL(request.url);
  return proxyAdminRequest(request, `/admin/deploy/cf/layout${url.search}`, publicApi);
};

export const GET: APIRoute = ({ request, locals }) => proxy(request, locals.PUBLIC_API);
export const PUT: APIRoute = ({ request, locals }) => proxy(request, locals.PUBLIC_API);
export const DELETE: APIRoute = ({ request, locals }) => proxy(request, locals.PUBLIC_API);
