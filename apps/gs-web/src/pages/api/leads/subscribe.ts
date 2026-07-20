import type { APIRoute } from 'astro';

export const prerender = false;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const apiBase = (env: Env | undefined) =>
  (env?.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');

const jsonError = (status: number, message: string) => Response.json({ message }, { status });

const forwardedHeaders = (request: Request) => {
  const headers = new Headers();
  for (const name of ['cf-connecting-ip', 'user-agent', 'x-forwarded-for']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return jsonError(415, 'Unsupported payload.');
  }

  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return jsonError(400, 'Invalid request body.');
  }

  if (typeof email !== 'string' || !emailPattern.test(email.trim())) {
    return jsonError(400, 'Please enter a valid email address.');
  }

  const env = locals.runtime?.env as Env | undefined;
  const target = new URL(`${apiBase(env)}/v1/forms/newsletter/submissions`);
  const formData = new FormData();
  formData.set('email', email.trim().toLowerCase());
  formData.set('redirectTo', '/');

  let response: Response;
  try {
    response = await fetch(target, {
      method: 'POST',
      headers: forwardedHeaders(request),
      body: formData,
    });
  } catch {
    return jsonError(503, 'Subscription service unavailable. Please try again later.');
  }

  if (!response.ok) {
    return jsonError(response.status, 'Subscription failed. Please try again.');
  }

  return Response.json({ success: true, message: 'Successfully subscribed!' }, { status: 200 });
};

export const GET: APIRoute = async () => jsonError(405, 'Method not allowed.');
