import { Hono } from 'hono';
import crypto from 'crypto';
import type { Env, Variables } from '../../types';

const webhooks = new Hono<{ Bindings: Env; Variables: Variables }>();

webhooks.post('/stripe', async (c) => {
  try {
    const signature = c.req.header('stripe-signature');
    if (!signature) return c.json({ error: 'Missing signature' }, 401);

    const body = await c.req.text();
    const secret = c.env.STRIPE_WEBHOOK_SECRET;

    const [timestamp, _, sig] = signature.split(',').map(s => s.split('=')[1]);
    const signedContent = `${timestamp}.${body}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    if (expectedSig !== sig) return c.json({ error: 'Invalid signature' }, 401);

    const event = JSON.parse(body);
    const db = c.env.PLATFORM_DB;

    switch (event.type) {
      case 'payment_intent.succeeded':
        await db
          .prepare('INSERT INTO payment_events (id, event_type, stripe_id, amount, status, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
          .bind(crypto.randomUUID(), 'payment_succeeded', event.data.object.id, event.data.object.amount, 'completed')
          .run();
        break;
      case 'customer.subscription.updated':
        await db
          .prepare('INSERT INTO subscription_events (id, event_type, stripe_id, customer_id, status, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
          .bind(crypto.randomUUID(), 'subscription_updated', event.data.object.id, event.data.object.customer, event.data.object.status)
          .run();
        break;
      case 'customer.subscription.deleted':
        await db
          .prepare('INSERT INTO subscription_events (id, event_type, stripe_id, customer_id, status, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
          .bind(crypto.randomUUID(), 'subscription_cancelled', event.data.object.id, event.data.object.customer, 'cancelled')
          .run();
        break;
    }

    return c.json({ received: true });
  } catch (error) {
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

webhooks.post('/google', async (c) => {
  try {
    const token = c.req.header('x-google-webhook-token');
    if (token !== c.env.GOOGLE_WEBHOOK_TOKEN) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const db = c.env.PLATFORM_DB;

    await db
      .prepare('INSERT INTO webhook_events (id, source, event_type, payload, processed, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
      .bind(crypto.randomUUID(), 'google_workspace', body.event_type || 'unknown', JSON.stringify(body), 0)
      .run();

    return c.json({ acknowledged: true });
  } catch (error) {
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

webhooks.post('/cloudflare', async (c) => {
  try {
    const auth = c.req.header('authorization');
    if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);

    const token = auth.substring(7);
    if (token !== c.env.CF_WEBHOOK_TOKEN) return c.json({ error: 'Invalid token' }, 403);

    const body = await c.req.json();
    const db = c.env.PLATFORM_DB;

    switch (body.type) {
      case 'worker.deployment':
        await db
          .prepare('INSERT INTO cf_events (id, event_type, worker_name, status, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)')
          .bind(crypto.randomUUID(), 'worker_deployed', body.worker_name, body.status || 'completed')
          .run();
        break;
      case 'route.created':
      case 'route.updated':
      case 'route.deleted':
        await db
          .prepare('INSERT INTO cf_events (id, event_type, route_pattern, status, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)')
          .bind(crypto.randomUUID(), body.type, body.route_pattern, 'processed')
          .run();
        break;
    }

    return c.json({ processed: true });
  } catch (error) {
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

webhooks.post('/github/:action', async (c) => {
  try {
    const signature = c.req.header('x-hub-signature-256');
    if (!signature) return c.json({ error: 'Missing webhook signature' }, 401);

    const body = await c.req.text();
    const secret = c.env.GS_GITHUB_WEBHOOK_SECRET;

    const expectedSig = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')}`;

    if (expectedSig !== signature) return c.json({ error: 'Invalid signature' }, 401);

    const event = c.req.header('x-github-event') || 'unknown';
    const action = c.req.param('action');
    const db = c.env.AUDIT_DB;

    await db
      .prepare('INSERT INTO github_webhooks (id, action, event_type, payload, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)')
      .bind(crypto.randomUUID(), action, event, body)
      .run();

    return c.json({ success: true, event });
  } catch (error) {
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

webhooks.post('/:event', async (c) => {
  try {
    const event = c.req.param('event');
    const body = await c.req.json();
    const db = c.env.PLATFORM_DB;

    await db
      .prepare('INSERT INTO webhook_events (id, source, event_type, payload, processed, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
      .bind(crypto.randomUUID(), 'application', event, JSON.stringify(body), 0)
      .run();

    return c.json({ received: true }, 202);
  } catch (error) {
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

export default webhooks;
