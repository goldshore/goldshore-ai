import type { APIRoute } from 'astro';
import {
  buildAdminSession,
  verifyAccessWithClaims,
  type Env as AccessEnv,
} from '@goldshore/auth';

export const prerender = false;

type ProductStatus = 'active' | 'beta' | 'coming_soon' | 'deprecated';

type ProductPlan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year' | 'one_time';
  features: string[];
};

type Product = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  description: string;
  features: string[];
  plans: ProductPlan[];
  settings: Record<string, unknown>;
  updatedAt: string;
};

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'risk-radar',
    name: 'Risk Radar',
    slug: 'risk-radar',
    status: 'beta',
    description: 'Real-time risk assessment and alerting for portfolio positions.',
    features: [
      'Sub-28ms signal latency',
      'Composite risk scoring',
      'Multi-asset support',
      'TCG and equity positions',
    ],
    plans: [
      {
        id: 'risk-radar-basic',
        name: 'Basic',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: ['5 assets monitored', 'Daily reports', 'Email alerts'],
      },
      {
        id: 'risk-radar-pro',
        name: 'Pro',
        price: 99,
        currency: 'USD',
        interval: 'month',
        features: ['Unlimited assets', 'Real-time alerts', 'API access'],
      },
    ],
    settings: { signalLatencyTarget: 28, compositeScoringEnabled: true, briefingEnabled: true },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'platform',
    name: 'Platform',
    slug: 'platform',
    status: 'active',
    description: 'Goldshore AI Platform — operational intelligence and automation.',
    features: ['AI Oracle', 'Financial Signals', 'Workflow Engine', 'Sentinel'],
    plans: [
      {
        id: 'platform-enterprise',
        name: 'Enterprise',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: ['Contact for pricing', 'Custom SLA'],
      },
    ],
    settings: { aiOracleEnabled: true, workflowEngineEnabled: true },
    updatedAt: new Date().toISOString(),
  },
];

const getCatalog = async (env: Env): Promise<{ products: Product[] }> => {
  const stored = await env.KV?.get('PRODUCT_CATALOG', 'json');
  return (stored as { products: Product[] } | null) ?? { products: DEFAULT_PRODUCTS };
};

const hasPermission = async (
  request: Request,
  env: AccessEnv & Env,
  permission: 'system:read' | 'system:write',
) => {
  const claims = await verifyAccessWithClaims(request, env);
  if (!claims) return false;
  const session = buildAdminSession(claims);
  return session.permissions.includes(permission);
};

const isSameOriginRequest = (request: Request) => {
  const expectedOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get('origin');
  if (originHeader) return originHeader === expectedOrigin;
  const referer = request.headers.get('referer');
  if (referer) {
    try { return new URL(referer).origin === expectedOrigin; } catch { return false; }
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'none';
  return false;
};

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.KV) return new Response('Storage unavailable.', { status: 503 });

  const ok = await hasPermission(request, env as never, 'system:read');
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  const catalog = await getCatalog(env);
  if (id) {
    const product = catalog.products.find((p) => p.id === id || p.slug === id);
    if (!product) return new Response('Product not found.', { status: 404 });
    return Response.json({ success: true, product });
  }

  return Response.json({ success: true, ...catalog });
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.KV) return new Response('Storage unavailable.', { status: 503 });

  if (!isSameOriginRequest(request)) return new Response('Forbidden: CSRF check failed.', { status: 403 });

  const ok = await hasPermission(request, env as never, 'system:write');
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response('id query param required.', { status: 400 });

  const body = await request.json() as Partial<Product>;
  if (!body) return new Response('Invalid payload.', { status: 400 });

  const catalog = await getCatalog(env);
  const idx = catalog.products.findIndex((p) => p.id === id || p.slug === id);
  if (idx === -1) return new Response('Product not found.', { status: 404 });

  const updated: Product = {
    ...catalog.products[idx],
    ...body,
    id: catalog.products[idx].id,
    slug: catalog.products[idx].slug,
    updatedAt: new Date().toISOString(),
  };
  catalog.products[idx] = updated;

  await env.KV.put('PRODUCT_CATALOG', JSON.stringify(catalog));
  return Response.json({ success: true, product: updated });
};

export const PATCH = PUT;
