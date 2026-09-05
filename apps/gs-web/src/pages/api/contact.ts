import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../lib/api-proxy';

export const POST: APIRoute = async (context) => {
  // Access the service binding from Cloudflare Workers environment
  let serviceBinding: any = undefined;
  if (!import.meta.env.DEV) {
    const { env } = await import('cloudflare:workers');
    serviceBinding = (env as any).API;
  }

  return proxyApiRequest(
    context.request,
    '/v1/forms/contact/submissions',
    context.locals.PUBLIC_API,
    serviceBinding
  );
};
