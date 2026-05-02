export interface Env {
  GS_SIGNALS_DB: D1Database;
  DISCORD_WEBHOOK_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/signal') {
      try {
        const payload = await request.json() as { signalType: string; symbol: string; price: number };

        if (payload.signalType === 'BUY') {
          // 1. Insert into gs_signals_db
          await env.GS_SIGNALS_DB.prepare(
            `INSERT INTO signals (type, symbol, price, timestamp) VALUES (?, ?, ?, ?)`
          ).bind(payload.signalType, payload.symbol, payload.price, Date.now()).run();

          // 2. Send Discord Notification
          if (env.DISCORD_WEBHOOK_URL) {
            await fetch(env.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `🚀 BUY SIGNAL: ${payload.symbol} @ $${payload.price}`
              })
            });
          }

          // 3. Trigger StellarAIO ATC endpoint (Mock endpoint representation)
          // For now, simulating the call to the bot/ATC.
          const stellarAioWebhook = 'http://localhost/stellar-aio-atc-webhook'; // Replace with actual StellarAIO ATC endpoint
          try {
              await fetch(stellarAioWebhook, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'ATC', product: payload.symbol })
              });
          } catch(e) {
              console.error('Failed to trigger StellarAIO', e)
          }

          return new Response(JSON.stringify({ status: 'success', message: 'Signal processed' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (e) {
         console.error('Error processing signal', e);
         return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
