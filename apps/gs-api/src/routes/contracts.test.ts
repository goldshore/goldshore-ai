import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import health from './health.ts';
import system from './system.ts';
import user from './user.ts';
import users from './users.ts';

describe('API contract/versioning', () => {
  it('health returns standard structure', async () => {
    const app = new Hono();
    app.route('/health', health);

    const res = await app.request('/health');
    assert.strictEqual(res.status, 200);
    const data = await res.json() as Record<string, unknown>;

    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.service, 'gs-api');
    assert.strictEqual(typeof data.timestamp, 'string');
    assert.strictEqual(typeof data.version, 'string');
  });

  it('system/version returns contract metadata', async () => {
    const app = new Hono<{ Variables: { accessClaims: any } }>();
    app.use('*', async (c, next) => {
      c.set('accessClaims', { roles: ['admin'], email: 'admin@example.com' });
      await next();
    });
    app.route('/system', system);

    const res = await app.request('/system/version', {}, { GIT_SHA: 'abc123' } as any);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as Record<string, unknown>;

    assert.strictEqual(data.version, 'abc123');
    assert.strictEqual(data.deploySha, 'abc123');
    assert.strictEqual(data.service, 'gs-api');
  });

  it('legacy /user/:id endpoint redirects to /users/:id', async () => {
    const app = new Hono<{ Variables: { accessClaims: any } }>();
    app.use('*', async (c, next) => {
      c.set('accessClaims', { roles: ['admin'], email: 'admin@example.com' });
      await next();
    });
    app.route('/user', user);

    const res = await app.request('/user/42', { redirect: 'manual' });
    assert.strictEqual(res.status, 308);
    assert.strictEqual(res.headers.get('location'), '/users/42');
    assert.strictEqual(res.headers.get('deprecation'), 'true');
  });

  it('canonical /users/:id endpoint serves record', async () => {
    const app = new Hono<{ Variables: { accessClaims: null } }>();
    app.use('*', async (c, next) => {
      c.set('accessClaims', null);
      await next();
    });
    app.route('/users', users as any);

    const res = await app.request('/users/42');
    assert.strictEqual(res.status, 403);
  });
});
