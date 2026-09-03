import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../lib/api-proxy';
const proxy: APIRoute = ({ request, locals, params }) => proxyAdminRequest(request, `/admin/workspaces/${params.path ?? ''}`, locals.PUBLIC_API);
export const GET = proxy; export const PUT = proxy; export const DELETE = proxy;
