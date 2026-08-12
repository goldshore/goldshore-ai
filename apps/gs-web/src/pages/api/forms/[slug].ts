import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

export const prerender = false;

/**
 * Admin UI form configuration item endpoint.
 *
 * Thin proxy to gs-api `/v1/forms/configs/:slug`, matching the sibling
 * `index.ts` collection route. Permission enforcement (`forms:read` for GET,
 * `forms:write` for PUT/PATCH) and CSRF checks live in gs-api so a single
 * implementation governs every client.
 */
const forward: APIRoute = ({ request, params, locals }) =>
  proxyApiRequest(
    request,
    `/v1/forms/configs/${encodeURIComponent(params.slug || '')}`,
    locals.PUBLIC_API,
  );

export const GET = forward;
export const PUT = forward;
export const PATCH = forward;
