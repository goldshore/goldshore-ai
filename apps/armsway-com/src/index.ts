export interface Env {
  GS_AUDIT_DB: D1Database;
  TELEMETRY_STORAGE: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // E-commerce tracking for disposable BP sleeve
    if (request.method === 'POST' && url.pathname === '/checkout') {
      try {
        const payload = await request.json() as { productId: string; quantity: number; orderId: string };
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

        return new Response(JSON.stringify({ status: 'success', message: 'Order processed and logged' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
         console.error('Error processing checkout', e);
         return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
      }
    }

    return new Response('Welcome to Armsway E-Commerce', { status: 200 });
  },
};
