import { Hono } from 'hono';

const mail = new Hono();

mail.get('/', (c) => c.json({ service: 'gs-api-mail', ok: true }));
mail.get('/health', (c) => c.json({ status: 'ok', service: 'gs-api-mail' }));
mail.get('/inbox/logs', async (c) => {
  const kv = (c.env as any).KV;
  const raw = kv ? await kv.get('EMAIL_INBOX_LOGS') : null;
  return c.json({ logs: raw ? JSON.parse(raw) : [] });
});

export default mail;
