import type { APIRoute } from 'astro';
import { requireAdminAccess } from '../../../lib/access';
import { getGsApiBaseUrl, buildGsApiHeaders } from '../../../lib/gs-api';
import { getServerEnv } from '../../../lib/server-env';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getServerEnv(locals as Record<string, unknown>);
  const access = await requireAdminAccess(request, env);

  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error }), {
      status: access.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const response = await fetch(`${getGsApiBaseUrl(env)}/system/version`, {
    headers: buildGsApiHeaders(request)
  });

  const payload = await response.json().catch(() => null);

  return new Response(
    JSON.stringify({
      ok: response.ok,
      version: payload?.version ?? 'unknown',
      service: payload?.service ?? 'gs-api',
      deploySha: payload?.deploySha ?? null,
      checkedAt: new Date().toISOString()
    }),
    {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
