import type { APIRoute } from 'astro';

interface Lead {
  id: string;
  email: string;
  subscribed_at: string;
  source: string;
  status: 'active' | 'pending' | 'unsubscribed';
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    // Get KV namespace from runtime
    const runtime = locals['runtime'] as Record<string, unknown> | undefined;
    const kv = runtime?.env?.['KV'] as Record<string, unknown> | undefined;

    if (!kv || typeof kv.list !== 'function') {
      return new Response(
        JSON.stringify({ leads: [], total: 0, message: 'Storage unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // List all keys starting with 'lead:'
    const listResult = await (kv.list as Function)({ prefix: 'lead:' });
    const keys = listResult.keys || [];

    // Fetch all lead records
    const leads: Lead[] = [];
    for (const keyObj of keys) {
      const key = typeof keyObj === 'string' ? keyObj : keyObj.name;
      const lead = await (kv.get as Function)(key, 'json');
      if (lead && typeof lead === 'object' && 'email' in lead) {
        leads.push(lead as Lead);
      }
    }

    // Sort by most recent first
    leads.sort((a, b) => new Date(b.subscribed_at).getTime() - new Date(a.subscribed_at).getTime());

    return new Response(
      JSON.stringify({
        leads,
        total: leads.length,
        success: true,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching leads:', error);
    return new Response(
      JSON.stringify({ leads: [], total: 0, error: 'Failed to fetch leads' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
