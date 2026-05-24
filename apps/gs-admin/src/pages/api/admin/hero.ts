import type { APIRoute } from 'astro';
import { requireAdminAccess } from '../../../lib/access';
import { getServerEnv } from '../../../lib/server-env';

const ALLOWED_VARIANTS = new Set(['orbital', 'defense', 'minimal']);
const DEFAULT_VARIANT = 'orbital';
const HERO_VARIANT_KEY = 'hero_variant';

type HeroConfigEnv = {
  GS_CONFIG?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
};

const buildErrorResponse = (status: number, message: string) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getServerEnv(locals as Record<string, unknown>) as HeroConfigEnv;
  const access = await requireAdminAccess(request, env, {
    requiredPermission: 'content:read',
  });

  if (!access.ok) {
    return buildErrorResponse(access.status, access.error ?? 'Unauthorized');
  }

  const variant = (await env.GS_CONFIG?.get(HERO_VARIANT_KEY)) ?? DEFAULT_VARIANT;

  return Response.json({
    variant: ALLOWED_VARIANTS.has(variant) ? variant : DEFAULT_VARIANT,
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getServerEnv(locals as Record<string, unknown>) as HeroConfigEnv;
  const access = await requireAdminAccess(request, env, {
    requiredPermission: 'content:write',
  });

  if (!access.ok) {
    return buildErrorResponse(access.status, access.error ?? 'Unauthorized');
  }

  const body = (await request.json().catch(() => null)) as { variant?: string } | null;
  const variant = body?.variant;

  if (!variant || !ALLOWED_VARIANTS.has(variant)) {
    return buildErrorResponse(400, 'Invalid hero variant.');
  }

  if (!env.GS_CONFIG) {
    return buildErrorResponse(503, 'GS_CONFIG binding missing.');
  }

  await env.GS_CONFIG.put(HERO_VARIANT_KEY, variant);

  return Response.json({ variant });
};
