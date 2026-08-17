import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../lib/api-proxy';
const proxy: APIRoute = ({ request, locals, params }) => proxyApiRequest(request, `/admin/automation/${params.path ?? ''}`, locals.PUBLIC_API);
export const GET = proxy; export const POST = proxy;
