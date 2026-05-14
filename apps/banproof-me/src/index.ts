export interface Env {
  PLATFORM_DB: D1Database;
  ASSETS: R2Bucket;
  BANPROOF_KV: KVNamespace;
  GOLDSHORE_KV: KVNamespace;
  TELEMETRY_STORAGE: R2Bucket;
  GS_PLATFORM_DB: D1Database;
  GS_AUDIT_DB: D1Database;
  GS_SIGNALS_DB: D1Database;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ status: 'ok', service: 'banproof-me' });
    }

    return json({ service: 'banproof-me', ok: true });
  },
};
