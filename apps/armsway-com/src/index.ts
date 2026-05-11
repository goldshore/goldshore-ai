export interface Env {
  GS_AUDIT_DB: D1Database;
  TELEMETRY_STORAGE: R2Bucket;
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
      return json({ status: 'ok', service: 'armsway-com' });
    }

    // E-commerce tracking for disposable BP sleeve
    if (request.method === 'POST' && url.pathname === '/checkout') {
      const authError = requireSecret(request, env);
      if (authError) return authError;

      let payload: { productId: string; quantity: number; orderId: string };
      try {
        payload = await request.json() as { productId: string; quantity: number; orderId: string };
      } catch {
        return json({ error: 'Invalid JSON in request body' }, 400);
      }

      if (typeof payload.productId !== 'string' || typeof payload.quantity !== 'number' || typeof payload.orderId !== 'string') {
        return json({ error: 'Missing or invalid required fields: productId, quantity, orderId' }, 400);
      }

      try {
        const transactionLog = JSON.stringify({ ...payload, timestamp: Date.now() });

        // 1. Log to GS_AUDIT_DB for tracking
        if (payload.productId === 'bp-sleeve-disposable') {
          await env.GS_AUDIT_DB.prepare(
            `INSERT INTO orders (order_id, product_id, quantity, timestamp) VALUES (?, ?, ?, ?)`
          ).bind(payload.orderId, payload.productId, payload.quantity, Date.now()).run();
        }

        // 2. Pipe all transaction logs into TELEMETRY_STORAGE for compliance
        await env.TELEMETRY_STORAGE.put(`transactions/${payload.orderId}.json`, transactionLog, {
          httpMetadata: { contentType: 'application/json' }
        });

        return json({ status: 'success', message: 'Order processed and logged' });
      } catch (e) {
        console.error('Error processing checkout', e);
        return json({ error: 'Internal Server Error' }, 500);
      }
    }

    return json({ service: 'armsway-com', ok: true });
  },
};
