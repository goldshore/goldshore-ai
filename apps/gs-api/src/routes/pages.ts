import { Hono } from 'hono';

export const pages = new Hono<{ Bindings: Env }>();

pages.get('/slug/:slug', async (c) => {
  const slug = c.req.param('slug');
  // Logic to fetch page from D1 or KV
  return c.json({
    id: 1,
    slug,
    title: 'Example Page',
    body: '<p>This is an example page served from the API.</p>',
    status: 'active'
  });
});
