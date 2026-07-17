import type { APIRoute } from 'astro';

export const prerender = false;

const shouldReturnJson = (request: Request) => {
  const accept = request.headers.get('accept') ?? '';
  const requestedWith = request.headers.get('x-requested-with') ?? '';
  return accept.includes('application/json') || requestedWith.toLowerCase() === 'fetch';
};

const buildError = (request: Request, status: number, code: string, message: string) =>
  shouldReturnJson(request)
    ? Response.json({ ok: false, code, message }, { status })
    : new Response(message, { status });

const apiBase = (env: Env | undefined) =>
  (env?.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');

const safeRedirect = (value: string | null, origin: string) => {
  if (!value) return new URL('/contact?submitted=1', origin);
  if (value.startsWith('/') && !value.startsWith('//')) return new URL(value, origin);
  try {
    const parsed = new URL(value);
    return parsed.origin === origin ? parsed : new URL('/contact?submitted=1', origin);
  } catch {
    return new URL('/contact?submitted=1', origin);
  }
};

const forwardedHeaders = (request: Request) => {
  const headers = new Headers();
  for (const name of ['accept', 'cf-connecting-ip', 'user-agent', 'x-forwarded-for']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!request.headers.get('content-type')?.includes('form')) {
    return buildError(request, 415, 'unsupported_payload', 'Unsupported payload.');
  }

  const formData = await request.formData();
  const formType = String(formData.get('formType') || 'contact');
  const redirectTo = String(formData.get('redirectTo') || '');
  const env = locals.runtime?.env as Env | undefined;
  const target = new URL(`${apiBase(env)}/v1/forms/${encodeURIComponent(formType)}/submissions`);

  let response: Response;
  try {
    response = await fetch(target, {
      method: 'POST',
      headers: forwardedHeaders(request),
      body: formData,
    });
  } catch {
    return buildError(request, 503, 'api_unavailable', 'Submission service unavailable.');
  }

  const responseText = await response.text();
  let payload: Record<string, unknown> | null = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (shouldReturnJson(request)) {
      return Response.json(payload ?? { ok: false, code: 'submission_failed' }, {
        status: response.status,
      });
    }
    return new Response(responseText || 'Submission failed.', { status: response.status });
  }

  const payloadRedirect = typeof payload?.redirectTo === 'string' ? payload.redirectTo : null;
  const redirectUrl = safeRedirect(payloadRedirect ?? redirectTo, new URL(request.url).origin);

  if (shouldReturnJson(request)) {
    return Response.json(payload ?? { ok: true, redirectTo: redirectUrl.pathname }, {
      status: response.status,
    });
  }

  return Response.redirect(redirectUrl, 303);
};

export const GET: APIRoute = async ({ request }) =>
  buildError(request, 405, 'method_not_allowed', 'Method not allowed.');
