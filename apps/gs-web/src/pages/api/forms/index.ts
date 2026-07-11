import type { APIRoute } from 'astro';

const apiBase = (env: Env | undefined) =>
  (env?.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');

const proxy = async (request: Request, env: Env | undefined) => {
  const incoming = new URL(request.url);
  const target = new URL(`${apiBase(env)}/v1/forms/configs`);
  target.search = incoming.search;
  return fetch(target, { method: request.method, headers: request.headers, body: request.method === 'GET' ? undefined : request.body, redirect: 'manual' });
};

export const GET: APIRoute = async ({ request, locals }) => proxy(request, locals.runtime?.env as Env | undefined);
export const POST: APIRoute = async ({ request, locals }) => proxy(request, locals.runtime?.env as Env | undefined);
