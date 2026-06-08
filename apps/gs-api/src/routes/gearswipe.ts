import { Hono } from 'hono';

const gearswipe = new Hono();

gearswipe.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'gearswipe-api-adapter',
    apiBase: 'https://api.goldshore.ai',
  }),
);

gearswipe.get('/search', (c) =>
  c.json({
    query: c.req.query('q') ?? '',
    results: [],
  }),
);

gearswipe.post('/listings/analyze', async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  return c.json({ status: 'accepted', operation: 'analyze', payload }, 202);
});

gearswipe.post('/watchlist', async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  return c.json({ status: 'accepted', operation: 'watchlist', payload }, 202);
});

export default gearswipe;
