export interface Env {
  GS_SIGNALS_DB: D1Database;
  DISCORD_WEBHOOK_URL?: string;
  STELLAR_AIO_WEBHOOK_URL?: string;
  WORKER_SECRET?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requireSecret(request: Request, env: Env): Response | null {
  if (!env.WORKER_SECRET) return null;
  if (request.headers.get('X-Worker-Secret') !== env.WORKER_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ status: 'ok', service: 'gs-core-worker' });
    }

    if (request.method === 'POST' && url.pathname === '/signal') {
      const authError = requireSecret(request, env);
      if (authError) return authError;

      let payload: { signalType: string; symbol: string; price: number };
      try {
        payload = await request.json() as { signalType: string; symbol: string; price: number };
      } catch {
        return json({ error: 'Invalid JSON in request body' }, 400);
      }

      if (typeof payload.signalType !== 'string' || typeof payload.symbol !== 'string' || typeof payload.price !== 'number') {
        return json({ error: 'Missing or invalid required fields: signalType, symbol, price' }, 400);
      }

      if (payload.signalType !== 'BUY') {
        return json({ status: 'ignored', message: `Signal type '${payload.signalType}' is not handled` }, 200);
      }

      try {
        // 1. Insert into gs_signals_db
        await env.GS_SIGNALS_DB.prepare(
          `INSERT INTO signals (type, symbol, price, timestamp) VALUES (?, ?, ?, ?)`
        ).bind(payload.signalType, payload.symbol, payload.price, Date.now()).run();

        // 2. Send Discord notification
        if (env.DISCORD_WEBHOOK_URL) {
          await fetch(env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `🚀 BUY SIGNAL: ${payload.symbol} @ $${payload.price}`
            })
          });
        }

        // 3. Trigger StellarAIO ATC endpoint
        if (env.STELLAR_AIO_WEBHOOK_URL) {
          try {
            await fetch(env.STELLAR_AIO_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'ATC', product: payload.symbol })
            });
          } catch (e) {
            console.error('Failed to trigger StellarAIO', e);
          }
        }

        return json({ status: 'success', message: 'Signal processed' });
      } catch (e) {
        console.error('Error processing signal', e);
        return json({ error: 'Internal Server Error' }, 500);
      }
    }

    return json({ error: 'Not Found' }, 404);
  },
};

