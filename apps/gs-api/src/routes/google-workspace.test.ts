import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { Hono } from 'hono';
import googleWorkspace from './google-workspace';
import type { Env, Variables } from '../types';

const database = () => ({
  prepare: mock.fn(() => ({
    first: mock.fn(async () => null),
    bind: mock.fn(() => ({
      all: mock.fn(async () => ({ results: [] })),
      run: mock.fn(async () => ({ success: true })),
    })),
  })),
});

const app = (role: 'admin' | 'viewer') => {
  const instance = new Hono<{ Bindings: Env; Variables: Variables }>();
  instance.use('*', async (c, next) => {
    c.set('accessClaims', { email: `${role}@example.com`, roles: [role] });
    await next();
  });
  instance.route('/admin/workspace', googleWorkspace);
  return instance;
};

describe('Google Workspace admin routes', () => {
  it('requires users:update for a manual synchronization', async () => {
    const response = await app('viewer').request(
      '/admin/workspace/sync',
      { method: 'POST' },
      { PLATFORM_DB: database(), KV: { put: mock.fn(async () => {}) } } as Env,
    );
    assert.equal(response.status, 403);
  });

  it('fails closed while synchronization is disabled', async () => {
    const response = await app('admin').request(
      '/admin/workspace/sync',
      { method: 'POST' },
      {
        PLATFORM_DB: database(),
        GOOGLE_WORKSPACE_SYNC_ENABLED: 'false',
      } as Env,
    );
    assert.equal(response.status, 503);
    assert.match(await response.text(), /disabled/);
  });
});
