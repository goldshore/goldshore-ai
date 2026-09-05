import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../lib/api-proxy';
const proxy: APIRoute = ({ request, locals, params }) => {
  const url = new URL(request.url);
  return proxyAdminRequest(request, `/sites/${params.path ?? ''}${url.search}`, locals.PUBLIC_API);
};
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
