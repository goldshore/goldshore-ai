import { Context, Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<{ Bindings: Env }>();

const CreateSubscriptionSchema = z.object({
  customer_id: z.string(),
  plan_id: z.string(),
  status: z.string().default('active'),
});

const SubscriptionSchema = z.object({
  id: z.string(),
  customer_id: z.string(),
  plan_id: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

type Subscription = z.infer<typeof SubscriptionSchema>;

async function ensureSubscriptionsTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `).run();
}

router.post('/', async (c: Context) => {
  try {
    const data = await c.req.json();
    const validated = CreateSubscriptionSchema.parse(data);

    const db = c.env.PLATFORM_DB as D1Database;
    await ensureSubscriptionsTable(db);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const result = await db
      .prepare(`
        INSERT INTO subscriptions (id, customer_id, plan_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(id, validated.customer_id, validated.plan_id, validated.status, now, now)
      .run();

    return c.json({
      success: true,
      data: {
        id,
        customer_id: validated.customer_id,
        plan_id: validated.plan_id,
        status: validated.status,
        created_at: now,
        updated_at: now,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error creating subscription:', error);
    return c.json({ success: false, error: 'Failed to create subscription' }, { status: 500 });
  }
});

router.get('/', async (c: Context) => {
  try {
    const db = c.env.PLATFORM_DB as D1Database;
    await ensureSubscriptionsTable(db);

    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const customerId = c.req.query('customer_id');

    let query = 'SELECT * FROM subscriptions';
    const params: any[] = [];

    if (customerId) {
      query += ' WHERE customer_id = ?';
      params.push(customerId);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await db.prepare(query).bind(...params).all();

    let countQuery = 'SELECT COUNT(*) as count FROM subscriptions';
    const countParams: any[] = [];
    if (customerId) {
      countQuery += ' WHERE customer_id = ?';
      countParams.push(customerId);
    }

    const countResult = await db.prepare(countQuery).bind(...countParams).first() as { count: number };

    return c.json({
      subscriptions: result.results || [],
      total: countResult?.count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return c.json({ success: false, error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
});

router.get('/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const db = c.env.PLATFORM_DB as D1Database;
    await ensureSubscriptionsTable(db);

    const result = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first();

    if (!result) {
      return c.json({ success: false, error: 'Subscription not found' }, { status: 404 });
    }

    return c.json({ subscription: result });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return c.json({ success: false, error: 'Failed to fetch subscription' }, { status: 500 });
  }
});

router.patch('/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const data = await c.req.json();

    const db = c.env.PLATFORM_DB as D1Database;
    await ensureSubscriptionsTable(db);

    const updates: string[] = [];
    const params: any[] = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.plan_id !== undefined) {
      updates.push('plan_id = ?');
      params.push(data.plan_id);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await db
      .prepare(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    const updated = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first();

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return c.json({ success: false, error: 'Failed to update subscription' }, { status: 500 });
  }
});

export default router;
