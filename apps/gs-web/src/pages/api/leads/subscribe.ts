import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

export const POST: APIRoute = async (context) => {
  const serviceBinding = (context.locals as any).runtime?.env?.API;
  return proxyApiRequest(
    context.request,
    '/v1/forms/newsletter/submissions',
    context.locals.PUBLIC_API,
    serviceBinding
  );
};
