import type { APIRoute } from 'astro';

export const prerender = false;

const apiBase = (env: Env | undefined) =>
  (env?.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');

const proxy = async (request: Request, env: Env | undefined, slug?: string) => {
  if (!slug) return new Response('Form slug is required.', { status: 400 });
  const incoming = new URL(request.url);
  const target = new URL(`${apiBase(env)}/v1/forms/configs/${encodeURIComponent(slug)}`);
  target.search = incoming.search;
  return fetch(target, { method: request.method, headers: request.headers, body: request.method === 'GET' ? undefined : request.body, redirect: 'manual' });
};

export const GET: APIRoute = async ({ request, locals, params }) => proxy(request, locals.runtime?.env as Env | undefined, params.slug);
export const PUT: APIRoute = async ({ request, locals, params }) => proxy(request, locals.runtime?.env as Env | undefined, params.slug);
export const PATCH = PUT;
