import type { APIRoute } from 'astro';

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

export const POST: APIRoute = async ({ request, locals }) => {
  if (!request.headers.get('content-type')?.includes('form')) {
    return buildError(request, 415, 'unsupported_payload', 'Unsupported payload.');
  }

  const formData = await request.formData();
  const formType = String(formData.get('formType') || 'contact');
  const redirectTo = String(formData.get('redirectTo') || '');
  const env = locals.runtime?.env as Env | undefined;
  const target = new URL(`${apiBase(env)}/v1/forms/${encodeURIComponent(formType)}/submissions`);
  const headers = new Headers(request.headers);
  headers.delete('content-length');

  const response = await fetch(target, {
    method: 'POST',
    headers,
    body: formData,
    redirect: 'manual',
  });

  const payload = await response.json().catch(() => null) as { submissionId?: string; redirectTo?: string; mail?: unknown; code?: string; message?: string } | null;
  if (!response.ok) {
    return buildError(request, response.status, payload?.code ?? 'submission_failed', payload?.message ?? 'Submission failed.');
  }

  const redirectUrl = safeRedirect(payload?.redirectTo ?? redirectTo, new URL(request.url).origin);
  if (shouldReturnJson(request)) {
    return Response.json({ ok: true, submissionId: payload?.submissionId, redirectTo: redirectUrl.pathname, mail: payload?.mail });
  }
  return Response.redirect(redirectUrl, 303);
};
