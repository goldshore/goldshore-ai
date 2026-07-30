import type { APIRoute } from 'astro';
import { authorizeAdminRequest, getAdminRouteRule } from '../../../../utils/admin-access';

const apiBase = (env: Env | undefined) =>
  (env?.PUBLIC_API || 'https://api.goldshore.ai').replace(/\/$/, '');

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  const rule = getAdminRouteRule('/api/admin/cf/workers', 'GET');
  if (!rule) {
    return new Response('Not found.', { status: 404 });
  }

  const authResult = await authorizeAdminRequest(request, env as never, rule);
  if (!authResult.ok) {
    const failure = authResult as Extract<typeof authResult, { ok: false }>;
    return new Response(failure.error, { status: failure.status });
  }

  const forwardHeaders = new Headers();
  const cookie = request.headers.get('cookie');
  const accessJwt = request.headers.get('cf-access-jwt-assertion');
  if (cookie) forwardHeaders.set('cookie', cookie);
  if (accessJwt) forwardHeaders.set('cf-access-jwt-assertion', accessJwt);

  try {
    const upstream = await fetch(`${apiBase(env)}/system/cf/workers`, { headers: forwardHeaders });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch {
    return Response.json({ success: false, error: 'Unable to reach api.goldshore.ai.' }, { status: 502 });
  }
};
