import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../../lib/api-proxy';

const target = (request: Request, path?: string) => {
  const url = new URL(request.url);
  return `/system/cf/tunnels${path ? `/${path}` : ''}${url.search}`;
};
const proxy: APIRoute = ({ request, locals, params }) => proxyAdminRequest(request, target(request, params.path), locals.PUBLIC_API);
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
