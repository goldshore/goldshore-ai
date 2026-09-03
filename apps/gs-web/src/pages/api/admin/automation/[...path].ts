import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../lib/api-proxy';
const proxy: APIRoute = ({ request, locals, params }) => proxyAdminRequest(request, `/admin/automation/${params.path ?? ''}`, locals.PUBLIC_API);
export const GET = proxy; export const POST = proxy;
