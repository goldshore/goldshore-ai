import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../lib/api-proxy';
const proxy: APIRoute = ({ request, locals }) => { const url = new URL(request.url); return proxyAdminRequest(request, `/integrations${url.search}`, locals.PUBLIC_API); };
export const GET = proxy; export const POST = proxy;
