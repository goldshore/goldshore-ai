import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', cors({
  origin: ['https://goldshore.ai', 'https://www.goldshore.ai', 'https://admin.goldshore.ai'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.get('/health', (c) => c.json({ status: 'ok', service: 'gs-gateway' }));

app.all('*', async (c) => {
  const host = new URL(c.req.url).hostname.toLowerCase();

  // Example routing logic
  if (host === 'api.goldshore.ai') {
    if (c.env.API_SERVICE) {
      return c.env.API_SERVICE.fetch(c.req.raw);
    }
    return c.json({ error: 'API service not bound' }, 500);
  }

  if (host === 'admin.goldshore.ai') {
    if (c.env.ADMIN_SERVICE) {
      return c.env.ADMIN_SERVICE.fetch(c.req.raw);
    }
    // Admin might be a Pages project, gateway might just handle API/Mail etc.
  }

  return c.json({ service: 'gs-gateway', message: 'No routing rule matched' }, 404);
});

export default app;
