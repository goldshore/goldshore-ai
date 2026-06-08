import type { APIRoute } from 'astro';
import { requireAdminAccess } from '../../../lib/access';
import { getGsApiBaseUrl, buildGsApiHeaders } from '../../../lib/gs-api';
import { getServerEnv } from '../../../lib/server-env';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getServerEnv(locals as Record<string, unknown>);
  const access = await requireAdminAccess(request, env);

  if (!access.ok) {
    return new Response(JSON.stringify({ success: false, error: access.error }), {
      status: access.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const response = await fetch(`${getGsApiBaseUrl(env)}/internal/inbox-status`, {
    headers: buildGsApiHeaders(request)
  });

  const payload = await response.json().catch(() => null);

  return new Response(
    JSON.stringify({
      success: response.ok && payload?.success === true,
      inbox: {
        count: payload?.inbox?.count ?? 0,
        recent: Array.isArray(payload?.inbox?.recent) ? payload.inbox.recent : []
      },
      timestamp: payload?.timestamp ?? new Date().toISOString(),
      error: response.ok ? null : payload?.error ?? 'Failed to fetch inbox status.'
    }),
    {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
