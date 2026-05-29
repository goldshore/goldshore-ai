import { Hono } from 'hono';

const sites = new Hono();

sites.get('/', (c) =>
  c.json({
    sites: [
      {
        id: 'goldshore-org',
        domain: 'goldshore.org',
        role: 'business-hub',
        status: 'active',
      },
    ],
  }),
);

sites.post('/', async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  return c.json({
    status: 'accepted',
    site: {
      id: crypto.randomUUID(),
      ...payload,
    },
  }, 202);
});

sites.get('/:siteId', (c) =>
  c.json({
    site: {
      id: c.req.param('siteId'),
      status: 'placeholder',
    },
  }),
);

sites.patch('/:siteId', async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  return c.json({
    status: 'updated',
    siteId: c.req.param('siteId'),
    patch: payload,
  });
});

sites.get('/:siteId/pages', (c) => c.json({ siteId: c.req.param('siteId'), pages: [] }));
sites.post('/:siteId/pages', async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  return c.json({ siteId: c.req.param('siteId'), page: payload }, 202);
});

export default sites;
