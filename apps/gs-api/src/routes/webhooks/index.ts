/**
 * Webhook Routes
 *
 * Handles incoming webhooks from third-party services:
 * - Stripe payment events
 * - Google Workspace directory sync
 * - Cloudflare Events
 * - Custom application webhooks
 */

import { Router } from 'itty-router';
import type { IRequest } from 'itty-router';
import crypto from 'crypto';

interface WebhookRequest extends IRequest {
  rawBody?: string;
}

export const webhookRouter = Router({ base: '/api/webhooks' });

// Stripe webhook handler
webhookRouter.post('/stripe', async (req: WebhookRequest, env: any) => {
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();
    const secret = env.STRIPE_WEBHOOK_SECRET;

    // Verify signature
    const [timestamp, _, sig] = signature.split(',').map(s => s.split('=')[1]);
    const signedContent = `${timestamp}.${body}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    if (expectedSig !== sig) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(body);
    const db = env.PLATFORM_DB;

    switch (event.type) {
      case 'payment_intent.succeeded':
        await db
          .prepare(
            `
            INSERT INTO payment_events (id, event_type, stripe_id, amount, status, timestamp)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `
          )
          .bind(
            crypto.randomUUID(),
            'payment_succeeded',
            event.data.object.id,
            event.data.object.amount,
            'completed'
          )
          .run();
        break;

      case 'customer.subscription.updated':
        await db
          .prepare(
            `
            INSERT INTO subscription_events (id, event_type, stripe_id, customer_id, status, timestamp)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `
          )
          .bind(
            crypto.randomUUID(),
            'subscription_updated',
            event.data.object.id,
            event.data.object.customer,
            event.data.object.status
          )
          .run();
        break;

      case 'customer.subscription.deleted':
        await db
          .prepare(
            `
            INSERT INTO subscription_events (id, event_type, stripe_id, customer_id, status, timestamp)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `
          )
          .bind(
            crypto.randomUUID(),
            'subscription_cancelled',
            event.data.object.id,
            event.data.object.customer,
            'cancelled'
          )
          .run();
        break;
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Google Workspace webhook handler
webhookRouter.post('/google', async (req: WebhookRequest, env: any) => {
  try {
    const token = req.headers.get('x-google-webhook-token');
    if (token !== env.GOOGLE_WEBHOOK_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const db = env.PLATFORM_DB;

    // Log webhook event
    await db
      .prepare(
        `
        INSERT INTO webhook_events (id, source, event_type, payload, processed, timestamp)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
      )
      .bind(
        crypto.randomUUID(),
        'google_workspace',
        body.event_type || 'unknown',
        JSON.stringify(body),
        0
      )
      .run();

    return new Response(JSON.stringify({ acknowledged: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Cloudflare Events webhook handler
webhookRouter.post('/cloudflare', async (req: WebhookRequest, env: any) => {
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = auth.substring(7);
    if (token !== env.CF_WEBHOOK_TOKEN) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const db = env.PLATFORM_DB;

    // Process CF event
    switch (body.type) {
      case 'worker.deployment':
        await db
          .prepare(
            `
            INSERT INTO cf_events (id, event_type, worker_name, status, timestamp)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `
          )
          .bind(
            crypto.randomUUID(),
            'worker_deployed',
            body.worker_name,
            body.status || 'completed'
          )
          .run();
        break;

      case 'route.created':
      case 'route.updated':
      case 'route.deleted':
        await db
          .prepare(
            `
            INSERT INTO cf_events (id, event_type, route_pattern, status, timestamp)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `
          )
          .bind(
            crypto.randomUUID(),
            body.type,
            body.route_pattern,
            'processed'
          )
          .run();
        break;
    }

    return new Response(JSON.stringify({ processed: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Generic webhook receiver for application events
webhookRouter.post('/:event', async (req: WebhookRequest, env: any) => {
  try {
    const { event } = req.params;
    const body = await req.json();
    const db = env.PLATFORM_DB;

    // Store webhook event
    await db
      .prepare(
        `
        INSERT INTO webhook_events (id, source, event_type, payload, processed, timestamp)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
      )
      .bind(
        crypto.randomUUID(),
        'application',
        event,
        JSON.stringify(body),
        0
      )
      .run();

    return new Response(JSON.stringify({ received: true }), { status: 202 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

export default webhookRouter;
