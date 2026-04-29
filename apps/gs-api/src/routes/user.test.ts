import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import user from './user';
import { Env, Variables } from '../types';

// Mock KV for audit logging in requirePermission
const mockKV = {
  put: mock.fn(async () => {}),
  get: mock.fn(async () => null),
  list: mock.fn(async () => ({ keys: [] })),
};

const createTestApp = (claims: any = null) => {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  // Middleware to set accessClaims and mock environment
  app.use('*', async (c, next) => {
    c.set('accessClaims', claims);
    c.env = { KV: mockKV } as any;
    await next();
  });

  app.route('/user', user);
  return app;
};

describe('User API Security', () => {
  it('GET /user/:id requires users:read permission (403 if missing)', async () => {
    const app = createTestApp({ roles: ['unknown'] });
    const res = await app.request('/user/123');

    assert.strictEqual(res.status, 403);
  });

  it('GET /user/:id allows access with users:read permission (admin role)', async () => {
    const app = createTestApp({ roles: ['admin'] });
    const res = await app.request('/user/123');

    assert.strictEqual(res.status, 308);
    assert.strictEqual(res.headers.get('Location'), '/users/123');
  });
});
