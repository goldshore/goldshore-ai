import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../lib/api-proxy';

export const POST: APIRoute = async (context) => {
  let serviceBinding: any;
  if (!import.meta.env.DEV) {
    const { env } = await import('cloudflare:workers');
    serviceBinding = (env as any).API;
  }
  return proxyApiRequest(context.request, '/v1/forms/newsletter/confirm', context.locals.PUBLIC_API, serviceBinding);
};
