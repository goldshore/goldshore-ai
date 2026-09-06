import { Context, Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<{ Bindings: Env }>();

const CreateCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  notes: z.string().optional(),
});

const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  status: z.string().default('active'),
  created_at: z.string(),
  updated_at: z.string(),
});

type Customer = z.infer<typeof CustomerSchema>;

async function ensureCustomersTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

router.post('/', async (c: Context) => {
  try {
    const data = await c.req.json();
    const validated = CreateCustomerSchema.parse(data);

    const db = c.env.PLATFORM_DB as D1Database;
    await ensureCustomersTable(db);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const result = await db
      .prepare(`
        INSERT INTO customers (id, name, email, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(id, validated.name, validated.email, validated.notes || null, now, now)
      .run();

    return c.json({
      success: true,
      data: {
        id,
        name: validated.name,
        email: validated.email,
        status: 'active',
        notes: validated.notes,
        created_at: now,
        updated_at: now,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error creating customer:', error);
    return c.json({ success: false, error: 'Failed to create customer' }, { status: 500 });
  }
});

router.get('/', async (c: Context) => {
  try {
    const db = c.env.PLATFORM_DB as D1Database;
    await ensureCustomersTable(db);

    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const search = c.req.query('search') || '';

    let query = 'SELECT * FROM customers';
    const params: any[] = [];

    if (search) {
      query += ' WHERE name LIKE ? OR email LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await db.prepare(query).bind(...params).all();

    let countQuery = 'SELECT COUNT(*) as count FROM customers';
    const countParams: any[] = [];
    if (search) {
      countQuery += ' WHERE name LIKE ? OR email LIKE ?';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const countResult = await db.prepare(countQuery).bind(...countParams).first() as { count: number };

    return c.json({
      customers: result.results || [],
      total: countResult?.count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return c.json({ success: false, error: 'Failed to fetch customers' }, { status: 500 });
  }
});

router.get('/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const db = c.env.PLATFORM_DB as D1Database;
    await ensureCustomersTable(db);

    const result = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();

    if (!result) {
      return c.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    return c.json({ customer: result });
  } catch (error) {
    console.error('Error fetching customer:', error);
    return c.json({ success: false, error: 'Failed to fetch customer' }, { status: 500 });
  }
});

router.patch('/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const data = await c.req.json();

    const db = c.env.PLATFORM_DB as D1Database;
    await ensureCustomersTable(db);

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      params.push(data.email);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await db
      .prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    const updated = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating customer:', error);
    return c.json({ success: false, error: 'Failed to update customer' }, { status: 500 });
  }
});

export default router;
