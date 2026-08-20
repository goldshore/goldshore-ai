import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

const handleRequest: APIRoute = async (context) => {
  const serviceBinding = (context.locals as any).runtime?.env?.API;
  return proxyApiRequest(
    context.request,
    '/v1/forms/configs',
    context.locals.PUBLIC_API,
    serviceBinding
  );
};

export const GET = handleRequest;
export const POST = handleRequest;
