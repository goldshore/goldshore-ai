import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const mail = new Hono<{ Bindings: Env; Variables: Variables }>();

mail.get('/', (c) => c.json({ service: 'gs-api-mail', ok: true }));
mail.get('/health', (c) => c.json({ status: 'ok', service: 'gs-api-mail' }));
mail.get('/inbox/logs', async (c) => {
  const raw = await c.env.KV.get('EMAIL_INBOX_LOGS');
  return c.json({ logs: raw ? JSON.parse(raw) : [] });
});

export default mail;
