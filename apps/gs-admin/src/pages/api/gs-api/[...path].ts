import type { APIRoute } from 'astro';
import { requireAdminAccess } from '../../../lib/access';
import { proxyToGsApi } from '../../../lib/gs-api-proxy';
import { getServerEnv } from '../../../lib/server-env';

const allowedPaths = new Set(['health', 'status', 'version', 'config', 'inbox-status']);

const handler: APIRoute = async ({ request, locals, params }) => {
  const path = params.path ?? '';
  if (!allowedPaths.has(path)) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  const env = getServerEnv(locals as Record<string, unknown>);
  const access = await requireAdminAccess(request, env);
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error }), { status: access.status, headers: { 'Content-Type': 'application/json' } });
  }

  return proxyToGsApi(env, request, `/${path}`);
};

export const GET = handler;
export const PUT = handler;
