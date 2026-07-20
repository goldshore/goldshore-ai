import type { APIRoute } from 'astro';

export const prerender = false;

const apiBase = (env: Env | undefined) =>
  (env?.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');

const forwardedHeaders = (request: Request) => {
  const headers = new Headers();
  for (const name of ['accept', 'authorization', 'cookie', 'cf-connecting-ip', 'user-agent', 'content-type']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
};

const proxy = async (request: Request, env: Env | undefined, slug?: string) => {
  if (!slug) return new Response('Form slug is required.', { status: 400 });

  const target = new URL(`${apiBase(env)}/v1/forms/configs/${encodeURIComponent(slug)}`);
  const response = await fetch(target, {
    method: request.method,
    headers: forwardedHeaders(request),
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
  });

  return new Response(response.body, { status: response.status, headers: response.headers });
};

export const GET: APIRoute = async ({ request, locals, params }) => proxy(request, locals.runtime?.env as Env | undefined, params.slug);
export const PUT: APIRoute = async ({ request, locals, params }) => proxy(request, locals.runtime?.env as Env | undefined, params.slug);
export const PATCH = PUT;
