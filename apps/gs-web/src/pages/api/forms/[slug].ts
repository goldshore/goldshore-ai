import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

export const prerender = false;

const forward: APIRoute = ({ request, params, locals }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response('Form slug is required.', { status: 400 });
  }

  return proxyApiRequest(
    request,
    `/v1/forms/configs/${encodeURIComponent(slug)}`,
    locals.PUBLIC_API,
  );
};

export const GET = forward;
export const PUT = forward;
export const PATCH = forward;
