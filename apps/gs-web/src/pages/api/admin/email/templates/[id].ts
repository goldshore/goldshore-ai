import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../../lib/api-proxy';

export const PUT: APIRoute = ({ request, locals, params }) => {
  const { id } = params;
  return proxyApiRequest(request, `/admin/email/templates/${id}`, locals.PUBLIC_API);
};

export const DELETE: APIRoute = ({ request, locals, params }) => {
  const { id } = params;
  return proxyApiRequest(request, `/admin/email/templates/${id}`, locals.PUBLIC_API);
};
