import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Hono } from 'hono';
import admin from './admin';
import type { Env, Variables } from '../types';

const createApp = (role = 'admin') => {
  const statements: Array<{ query: string; values: unknown[] }> = [];
  const database = {
    prepare(query: string) {
      const statement = { query, values: [] as unknown[] };
      statements.push(statement);
      const bound = {
        bind: (...values: unknown[]) => { statement.values = values; return bound; },
        all: async () => query.includes('FROM users')
          ? { results: [{ id: 'u1', email: 'operator@goldshore.ai', display_name: 'Operator', status: 'active', role: 'admin', created_at: '2026-01-01', updated_at: '2026-01-01' }] }
          : { results: [] },
        first: async () => query.includes('COUNT(*)') ? { total: 31 } : null,
        run: async () => ({ meta: { changes: 1 } }),
      };
      return bound;
    },
    batch: async () => [],
  };
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.use('*', async (c, next) => { c.set('accessClaims', { roles: [role], email: `${role}@goldshore.ai` }); await next(); });
  app.route('/admin', admin);
  return { app, env: { PLATFORM_DB: database } as unknown as Env, statements };
};

describe('Phase 1 admin contracts', () => {
  test('user directory is paginated and bounded', async () => {
    const { app, env, statements } = createApp();
    const response = await app.request('/admin/users?page=2&pageSize=500', {}, env);
    assert.equal(response.status, 200);
    const payload = await response.json() as { items: unknown[]; pagination: { page: number; pageSize: number; total: number; pages: number } };
    assert.equal(payload.items.length, 1);
    assert.deepEqual(payload.pagination, { page: 2, pageSize: 100, total: 31, pages: 1 });
    const select = statements.find((statement) => statement.query.includes('ORDER BY u.created_at'));
    assert.deepEqual(select?.values, [100, 100]);
  });

  test('settings rejects insecure API origins', async () => {
    const { app, env } = createApp();
    const response = await app.request('/admin/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apiUrl: 'http://api.example.com', llmProvider: 'claude' }) }, env);
    assert.equal(response.status, 400);
    assert.match(await response.text(), /HTTPS/);
  });

  test('viewer cannot update settings', async () => {
    const { app, env } = createApp('viewer');
    const response = await app.request('/admin/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' }, env);
    assert.equal(response.status, 403);
  });

  test('mail queue history filters status without exposing hashes', async () => {
    const { app, env, statements } = createApp();
    const response = await app.request('/admin/email/jobs?status=failed&pageSize=10', {}, env);
    assert.equal(response.status, 200);
    const payload = await response.json() as { items: unknown[]; pagination: { pageSize: number } };
    assert.equal(payload.pagination.pageSize, 10);
    assert.equal(JSON.stringify(payload).includes('recipient_hash'), false);
    const select = statements.find((statement) => statement.query.includes('FROM mail_jobs') && statement.query.includes('ORDER BY'));
    assert.deepEqual(select?.values, ['failed', 10, 0]);
  });
});
