import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { verifyAdminAuth, parsePagination, errorHandler } from './middleware/auth';
import * as usersDb from './db/users';

const users = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply auth middleware
users.use('*', verifyAdminAuth);
users.use('*', parsePagination);

// Routes with specific paths (must come before parameterized routes)

/**
 * POST /api/admin/users/invite
 * Create a pending user invitation (frontend compatible endpoint)
 */
users.post('/invite', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const currentUser = c.get('user');
  const body = await c.req.json();

  if (!body.email || !body.displayName) {
    return c.json(
      { error: 'Missing required fields: email, displayName' },
      400
    );
  }

  // Check if user already exists
  const existing = await usersDb.getUserByEmail(db, body.email);
  if (existing) {
    return c.json({ error: 'User already exists' }, 409);
  }

  // Create user with invited status
  await usersDb.createUser(db, {
    email: body.email,
    name: body.displayName,
    role: body.role || 'viewer',
    permissions: body.permissions || [],
  });

  // TODO: Generate one-time token and send invitation email
  const invitationToken = crypto.randomUUID();

  console.log(`[AUDIT] ${currentUser.email} created invitation for: ${body.email}`);

  return c.json({
    success: true,
    message: 'Invitation created',
    invitation: {
      email: body.email,
      token: invitationToken,
    },
  }, 201);
}));

// Routes with parameterized paths (must come after specific routes)

/**
 * GET /api/admin/users
 * List admin users with pagination support for both page and offset
 */
users.get('/', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const { offset, limit } = c.get('pagination');

  const result = await usersDb.getAdminUsers(db, {
    offset,
    limit,
    role: c.req.query('role'),
    status: c.req.query('status'),
  });

  // Format response for frontend expectations
  const pages = Math.ceil((result.total || 0) / limit);
  return c.json({
    items: (result.items || []).map((user: any) => ({
      id: user.id,
      email: user.email,
      display_name: user.name,
      name: user.name,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      invited_at: user.invited_at,
      accepted_at: user.accepted_at,
      last_login: user.last_login,
    })),
    pagination: {
      page: Math.floor(offset / limit) + 1,
      pages,
      total: result.total,
      offset,
      limit,
    },
  });
}));

/**
 * POST /api/admin/users
 * Create new admin user
 */
users.post('/', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const currentUser = c.get('user');
  const body = await c.req.json();

  if (!body.email || !body.name || !body.role) {
    return c.json(
      { error: 'Missing required fields: email, name, role' },
      400
    );
  }

  // Check if user already exists
  const existing = await usersDb.getUserByEmail(db, body.email);
  if (existing) {
    return c.json({ error: 'User already exists' }, 409);
  }

  await usersDb.createUser(db, {
    email: body.email,
    name: body.name,
    role: body.role,
    permissions: body.permissions || [],
  });

  console.log(`[AUDIT] ${currentUser.email} created user: ${body.email}`);

  return c.json({
    success: true,
    message: 'User created and invitation sent',
  }, 201);
}));

/**
 * POST /api/admin/users/:id/disable
 * Disable/remove user access (frontend compatible endpoint)
 */
users.post('/:id/disable', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');
  const currentUser = c.get('user');

  const user = await usersDb.getUserById(db, id);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  await usersDb.revokeUserAccess(db, id);

  console.log(`[AUDIT] ${currentUser.email} disabled user: ${user.email}`);

  return c.json({
    success: true,
    message: 'User access revoked',
  });
}));

/**
 * POST /api/admin/users/:id/resend-invite
 * Resend invitation email
 */
users.post('/:id/resend-invite', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');
  const currentUser = c.get('user');

  const user = await usersDb.getUserById(db, id);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // TODO: Send invitation email via Email Queue
  console.log(`[AUDIT] ${currentUser.email} resent invite to ${user.email}`);

  return c.json({
    success: true,
    message: 'Invitation resent',
  });
}));

/**
 * GET /api/admin/users/:id
 * Get single user
 */
users.get('/:id', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');

  const user = await usersDb.getUserById(db, id);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Don't expose permissions array in detail view
  const { permissions: _, ...safeUser } = user;
  return c.json(safeUser);
}));

/**
 * POST /api/admin/users/:id
 * Update user (role, permissions)
 */
users.post('/:id', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');
  const currentUser = c.get('user');
  const body = await c.req.json();

  await usersDb.updateUser(db, id, {
    name: body.name,
    role: body.role,
    permissions: body.permissions,
  });

  console.log(`[AUDIT] ${currentUser.email} updated user ${id}`);

  return c.json({ success: true, message: 'User updated' });
}));

/**
 * PATCH /api/admin/users/:id
 * Quickly update user role and status
 */
users.patch('/:id', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');
  const currentUser = c.get('user');
  const body = await c.req.json();

  const user = await usersDb.getUserById(db, id);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  await usersDb.updateUser(db, id, {
    role: body.role,
    status: body.status,
  });

  console.log(`[AUDIT] ${currentUser.email} updated user ${id}`);

  return c.json({ success: true, message: 'User updated' });
}));

/**
 * DELETE /api/admin/users/:id
 * Remove user (revoke access)
 */
users.delete('/:id', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const id = c.req.param('id');
  const currentUser = c.get('user');

  await usersDb.revokeUserAccess(db, id);

  console.log(`[AUDIT] ${currentUser.email} revoked access for user ${id}`);

  return c.json({ success: true, message: 'User access revoked' });
}));

export default users;
