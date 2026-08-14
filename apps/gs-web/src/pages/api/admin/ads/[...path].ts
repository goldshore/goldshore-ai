import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../lib/api-proxy';
const proxy: APIRoute = ({ request, locals, params }) => { const url = new URL(request.url); return proxyApiRequest(request, `/admin/ads/${params.path ?? ''}${url.search}`, locals.PUBLIC_API); };
export const GET = proxy; export const POST = proxy; export const PATCH = proxy; export const DELETE = proxy;
