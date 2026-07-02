import type { APIRoute } from 'astro';
import { getIntegrationRegistry, INTEGRATION_DEFINITIONS } from '../../../lib/integrations/IntegrationRegistry';

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const runtime = locals['runtime'] as Record<string, unknown> | undefined;
    const kv = runtime?.env?.['KV'] as Record<string, unknown> | undefined;

    const registry = getIntegrationRegistry(kv);
    await registry.loadFromStorage();

    const action = url.searchParams.get('action') || 'list';

    if (action === 'list') {
      const metrics = await registry.getDashboardMetrics();
      return new Response(JSON.stringify({ success: true, data: metrics }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'definitions') {
      return new Response(JSON.stringify({ success: true, data: INTEGRATION_DEFINITIONS }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync') {
      const results = await registry.syncAll();
      return new Response(JSON.stringify({ success: true, data: results }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      const statuses = await registry.getStatuses();
      return new Response(JSON.stringify({ success: true, data: statuses }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Integration management error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { action, config } = body;

    const runtime = locals['runtime'] as Record<string, unknown> | undefined;
    const kv = runtime?.env?.['KV'] as Record<string, unknown> | undefined;

    if (!kv) {
      return new Response(
        JSON.stringify({ error: 'Storage unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create' && config) {
      const registry = getIntegrationRegistry(kv);
      const integration = registry.createIntegration(config);

      // Test connection
      const connected = await integration.authenticate();

      if (typeof (kv as any).put === 'function') {
        await (kv as any).put(
          `integration:${config.name}`,
          JSON.stringify(config),
          { expirationTtl: 365 * 24 * 60 * 60 }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            name: config.name,
            connected,
            message: connected ? 'Integration created and connected' : 'Integration created but authentication failed',
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete' && config?.name) {
      if (typeof (kv as any).delete === 'function') {
        await (kv as any).delete(`integration:${config.name}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Integration deleted' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Integration creation error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
