import { Hono } from 'hono';
import { requirePermission, getActor, logAdminAction } from '../auth';
import type { Env, Variables } from '../types';

const products = new Hono<{ Bindings: Env; Variables: Variables }>();

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
        features: ['Unlimited assets', 'Real-time alerts', 'API access', 'Webhook integrations'],
      },
    ],
    settings: {
      signalLatencyTarget: 28,
      compositeScoringEnabled: true,
      briefingEnabled: true,
    },
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
        features: ['Contact for pricing', 'Custom SLA', 'Dedicated support'],
      },
    ],
    settings: {
      aiOracleEnabled: true,
      workflowEngineEnabled: true,
    },
    updatedAt: new Date().toISOString(),
  },
];

const getCatalog = async (kv: KVNamespace): Promise<{ products: Product[] }> => {
  const stored = await kv.get('PRODUCT_CATALOG', 'json');
  return (stored as { products: Product[] } | null) ?? { products: DEFAULT_PRODUCTS };
};

// GET /products
products.get('/', requirePermission('system:read'), async (c) => {
  const catalog = await getCatalog(c.env.KV);
  return c.json({ success: true, ...catalog });
});

// GET /products/:id
products.get('/:id', requirePermission('system:read'), async (c) => {
  const { id } = c.req.param();
  const catalog = await getCatalog(c.env.KV);
  const product = catalog.products.find((p) => p.id === id || p.slug === id);
  if (!product) return c.json({ error: 'Product not found.' }, 404);
  return c.json({ success: true, product });
});

// PUT /products/:id
products.put('/:id', requirePermission('system:write'), async (c) => {
  const actor = getActor(c.get('accessClaims'), c.req.raw);
  const { id } = c.req.param();
  const body = await c.req.json<Partial<Product>>().catch(() => null);
  if (!body) return c.json({ error: 'Invalid payload.' }, 400);

  const catalog = await getCatalog(c.env.KV);
  const idx = catalog.products.findIndex((p) => p.id === id || p.slug === id);
  if (idx === -1) return c.json({ error: 'Product not found.' }, 404);

  const updated: Product = {
    ...catalog.products[idx],
    ...body,
    id: catalog.products[idx].id,
    slug: catalog.products[idx].slug,
    updatedAt: new Date().toISOString(),
  };
  catalog.products[idx] = updated;

  await c.env.KV.put('PRODUCT_CATALOG', JSON.stringify(catalog));
  await logAdminAction(c.env, {
    action: 'products.update',
    actor,
    status: 'success',
    metadata: { productId: id },
  });

  return c.json({ success: true, product: updated });
});

// POST /products — create new product
products.post('/', requirePermission('system:write'), async (c) => {
  const actor = getActor(c.get('accessClaims'), c.req.raw);
  const body = await c.req.json<Omit<Product, 'id' | 'updatedAt'>>().catch(() => null);
  if (!body?.name || !body?.slug) return c.json({ error: 'name and slug required.' }, 400);

  const catalog = await getCatalog(c.env.KV);
  if (catalog.products.find((p) => p.slug === body.slug)) {
    return c.json({ error: 'Product with this slug already exists.' }, 409);
  }

  const product: Product = {
    ...body,
    id: body.slug,
    updatedAt: new Date().toISOString(),
  };
  catalog.products.push(product);

  await c.env.KV.put('PRODUCT_CATALOG', JSON.stringify(catalog));
  await logAdminAction(c.env, {
    action: 'products.create',
    actor,
    status: 'success',
    metadata: { productId: product.id },
  });

  return c.json({ success: true, product }, 201);
});

export default products;
