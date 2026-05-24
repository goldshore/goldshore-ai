import type { APIRoute } from 'astro';
import { ServiceStatusSchema } from '@goldshore/schema';
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

  const response = await fetch(`${getGsApiBaseUrl(env)}/system/status`, {
    headers: buildGsApiHeaders(request)
  });

  const payload = await response.json().catch(() => null);
  const parsedStatus = ServiceStatusSchema.safeParse(payload);

  return new Response(
    JSON.stringify({
      ok: response.ok,
      status: payload?.status ?? 'unknown',
      maintenanceMode: parsedStatus.success ? parsedStatus.data.maintenance_mode : false,
      activeServices: parsedStatus.success ? parsedStatus.data.active_services : [],
      apiConfigPresent: parsedStatus.success ? Boolean(parsedStatus.data.api_config) : false,
      service: payload?.service ?? 'gs-api',
      uptime: payload?.uptime ?? null,
      checkedAt: new Date().toISOString()
    }),
    {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
