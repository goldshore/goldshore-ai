import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import pages from './pages';
import { Env, Variables } from '../types';

const mockQuery = {
  all: mock.fn(async () => ({ results: [] })),
  first: mock.fn(async () => null),
  run: mock.fn(async () => ({ meta: { last_row_id: 1, changes: 1 } })),
};

// Mock DB
const mockDB = {
  prepare: mock.fn(() => ({
    bind: mock.fn(() => mockQuery),
    ...mockQuery
  })),
};

// Mock KV
const mockKV = {
  put: mock.fn(async () => {}),
  get: mock.fn(async () => null),
  list: mock.fn(async () => ({ keys: [] })),
};

const createTestApp = (claims: any = null) => {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  // Middleware to set accessClaims
  app.use('*', async (c, next) => {
    c.set('accessClaims', claims);
    c.env = { DB: mockDB, KV: mockKV } as any;
    await next();
  });

  app.route('/pages', pages);
  return app;
};

describe('Pages API Security', () => {
  it('GET /pages requires content:read permission (403 if missing)', async () => {
    // Viewer role has content:read, so let's use a role that doesn't have it, or empty roles.
    // 'unknown' role.
    const app = createTestApp({ roles: ['unknown'] });
    const res = await app.request('/pages');
    assert.strictEqual(res.status, 403);
  });

  it('GET /pages allows access with content:read permission', async () => {
    const app = createTestApp({ roles: ['viewer'] }); // Viewer has content:read
    const res = await app.request('/pages');
    assert.strictEqual(res.status, 200);
  });

  it('POST /pages requires content:write permission (403 if missing)', async () => {
    const app = createTestApp({ roles: ['viewer'] }); // Viewer has content:read but not content:write
    const res = await app.request('/pages', {
      method: 'POST',
      body: JSON.stringify({ slug: 'test', title: 'Test', body: 'Body' }),
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(res.status, 403);
  });

  it('POST /pages allows access with content:write permission', async () => {
    const app = createTestApp({ roles: ['admin'] }); // Admin has content:write
    const res = await app.request('/pages', {
      method: 'POST',
      body: JSON.stringify({ slug: 'test', title: 'Test', body: 'Body' }),
      headers: { 'Content-Type': 'application/json' }
    });
    // Should pass authorization (not 403).
    assert.notStrictEqual(res.status, 403);
  });

  it('DELETE /pages/:id requires content:write permission', async () => {
     const app = createTestApp({ roles: ['viewer'] });
     const res = await app.request('/pages/1', { method: 'DELETE' });
     assert.strictEqual(res.status, 403);
  });

  it('PATCH /pages/:id/status requires content:publish permission', async () => {
    const app = createTestApp({ roles: ['editor'] });
    const res = await app.request('/pages/1/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'published' }),
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(res.status, 403);

    const adminApp = createTestApp({ roles: ['admin'] });
    const adminRes = await adminApp.request('/pages/1/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'published' }),
      headers: { 'Content-Type': 'application/json' }
    });
    assert.notStrictEqual(adminRes.status, 403);
  });
});
