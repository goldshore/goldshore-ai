import { test } from 'node:test';
import assert from 'node:assert';
import { evaluateAdminAccess } from '../../src/lib/access.ts';

test('evaluateAdminAccess returns 401 when no claims are present', () => {
  const result = evaluateAdminAccess(null, {});

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 401);
  assert.strictEqual(result.error, 'Unauthorized');
});

test('evaluateAdminAccess returns 403 when caller has no admin role', () => {
  const result = evaluateAdminAccess(
    {
      sub: 'user-1',
      email: 'viewer@example.com',
      roles: ['member'],
    },
    {},
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 403);
  assert.strictEqual(result.error, 'Admin role required.');
});

test('evaluateAdminAccess enforces required permissions', () => {
  const result = evaluateAdminAccess(
    {
      sub: 'user-2',
      email: 'viewer@example.com',
      roles: ['viewer'],
    },
    {},
    {
      requiredPermission: 'content:write',
    },
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 403);
  assert.strictEqual(result.error, 'Missing content:write permission.');
});

test('evaluateAdminAccess accepts valid admin claims', () => {
  const result = evaluateAdminAccess(
    {
      sub: 'user-3',
      email: 'admin@example.com',
      roles: ['admin'],
    },
    {},
    {
      requiredPermission: 'users:manage',
    },
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.error, null);
  assert.deepStrictEqual(result.session.roles, ['admin']);
});
