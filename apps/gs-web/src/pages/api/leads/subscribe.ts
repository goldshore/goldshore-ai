import type { APIRoute } from 'astro';

interface SubscriptionRequest {
  email?: string;
}

interface Lead {
  id: string;
  email: string;
  subscribed_at: string;
  source: string;
  status: 'active' | 'pending' | 'unsubscribed';
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: SubscriptionRequest = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ message: 'Email is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!validateEmail(email.trim())) {
      return new Response(
        JSON.stringify({ message: 'Please enter a valid email address.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Get KV namespace from runtime
    const runtime = locals['runtime'] as Record<string, unknown> | undefined;
    const kv = runtime?.env?.['KV'] as Record<string, unknown> | undefined;

    if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
      console.error('KV namespace not available');
      return new Response(
        JSON.stringify({ message: 'Storage unavailable. Please try again later.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if email already exists
    const existingKey = `lead:${trimmedEmail}`;
    const existing = await (kv.get as Function)(existingKey, 'json');

    if (existing) {
      return new Response(
        JSON.stringify({ message: 'This email is already subscribed.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create new lead record
    const lead: Lead = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email: trimmedEmail,
      subscribed_at: new Date().toISOString(),
      source: 'website-footer',
      status: 'active',
    };

    // Store in KV
    await (kv.put as Function)(existingKey, JSON.stringify(lead), {
      expirationTtl: 365 * 24 * 60 * 60, // 1 year
    });

    // Also add to a list for easy retrieval
    const listKey = 'leads:all';
    const leadsList = (await (kv.get as Function)(listKey, 'json')) || [];
    if (Array.isArray(leadsList)) {
      leadsList.push(lead.id);
      await (kv.put as Function)(listKey, JSON.stringify(leadsList));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully subscribed!',
        leadId: lead.id,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Subscription error:', error);
    return new Response(
      JSON.stringify({ message: 'An error occurred. Please try again.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
