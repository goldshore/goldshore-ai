import { Hono } from 'hono';

export const media = new Hono<{ Bindings: Env }>();

media.get('/:id', async (c) => {
  const id = c.req.param('id');
  // Logic to fetch media from R2
  return c.json({ id, url: 'https://assets.goldshore.ai/example.png' });
});
