import { Hono } from 'hono';

const core = new Hono();
const json = (c: any, body: unknown, status = 200) => c.json(body, status);
const requireSecret = (c: any) => c.env.WORKER_SECRET && c.req.header('X-Worker-Secret') !== c.env.WORKER_SECRET;

core.get('/health', (c) => c.json({ status: 'ok', service: 'gs-api-core' }));
core.post('/signal', async (c) => {
  if (requireSecret(c)) return json(c, { error: 'Unauthorized' }, 401);
  let payload: { signalType: string; symbol: string; price: number };
  try { payload = await c.req.json(); } catch { return json(c, { error: 'Invalid JSON in request body' }, 400); }
  if (typeof payload.signalType !== 'string' || !payload.signalType || typeof payload.symbol !== 'string' || !payload.symbol || typeof payload.price !== 'number' || !Number.isFinite(payload.price) || payload.price <= 0) {
    return json(c, { error: 'Missing or invalid required fields: signalType, symbol, price (must be a positive number)' }, 400);
  }
  if (payload.signalType !== 'BUY') return json(c, { status: 'ignored', message: `Signal type '${payload.signalType}' is not handled` });
  const db = c.env.SIGNALS_DB ?? c.env.GS_SIGNALS_DB;
  if (db) await db.prepare('INSERT INTO signals (type, symbol, price, timestamp) VALUES (?, ?, ?, ?)').bind(payload.signalType, payload.symbol, payload.price, Date.now()).run();
  if (c.env.DISCORD_WEBHOOK_URL) await fetch(c.env.DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `🚀 BUY SIGNAL: ${payload.symbol} @ $${payload.price}` }) });
  if (c.env.STELLAR_AIO_WEBHOOK_URL) await fetch(c.env.STELLAR_AIO_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ATC', product: payload.symbol }) });
  return json(c, { status: 'success', message: 'Signal processed' });
});

export default core;
