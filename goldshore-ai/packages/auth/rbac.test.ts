import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  extractAccessRoles,
  getAdminRoles,
  getAdminPermissions,
  buildAdminSession,
  hasAdminPermission,
  type AdminRole,
  type AdminPermission
} from './rbac.ts';

describe('RBAC Helpers', () => {
  describe('extractAccessRoles', () => {
    test('returns empty array for null claims', () => {
      assert.deepStrictEqual(extractAccessRoles(null), []);
    });

    test('extracts roles from roles string', () => {
      assert.deepStrictEqual(extractAccessRoles({ roles: 'admin' } as any), ['admin']);
    });

    test('extracts roles from roles array', () => {
      assert.deepStrictEqual(extractAccessRoles({ roles: ['admin', 'editor'] } as any), ['admin', 'editor']);
    });

    test('extracts roles from role string', () => {
      assert.deepStrictEqual(extractAccessRoles({ role: 'viewer' } as any), ['viewer']);
    });

    test('extracts roles from groups array', () => {
      assert.deepStrictEqual(extractAccessRoles({ groups: ['staff', 'management'] } as any), ['staff', 'management']);
    });

    test('combines and de-duplicates roles from multiple fields', () => {
      const claims = {
        roles: ['admin', 'editor'],
        role: 'admin',
        groups: ['editor', 'viewer']
      };
      // admin and editor are duplicated, viewer is unique
      const result = extractAccessRoles(claims as any);
      assert.strictEqual(result.length, 3);
      assert.ok(result.includes('admin'));
      assert.ok(result.includes('editor'));
      assert.ok(result.includes('viewer'));
    });

    test('normalizes roles (trim and lowercase)', () => {
      const claims = {
        roles: ['  Admin  ', 'EDITOR'],
        role: ' Viewer ',
        groups: ' STAFF '
      };
      const result = extractAccessRoles(claims as any);
      assert.deepStrictEqual(result.sort(), ['admin', 'editor', 'staff', 'viewer'].sort());
    });
  });

  describe('getAdminRoles', () => {
    test('filters out non-admin roles', () => {
      const claims = {
        roles: ['admin', 'user', 'guest', 'editor']
      };
      const result = getAdminRoles(claims as any);
      assert.deepStrictEqual(result.sort(), ['admin', 'editor'].sort());
    });

    test('returns empty array if no admin roles present', () => {
      const claims = {
        roles: ['user', 'guest']
      };
      assert.deepStrictEqual(getAdminRoles(claims as any), []);
    });
  });

  describe('getAdminPermissions', () => {
    test('returns permissions for a single role', () => {
      const result = getAdminPermissions(['viewer']);
      assert.ok(result.includes('content:read'));
      assert.ok(result.includes('media:read'));
      assert.ok(result.includes('forms:read'));
      assert.strictEqual(result.length, 3);
    });

    test('unions permissions for multiple roles without duplicates', () => {
      const result = getAdminPermissions(['editor', 'viewer']);
      // editor has content:read/write, media:read/write, forms:read/write
      // viewer has content:read, media:read, forms:read
      // union should be same as editor
      assert.ok(result.includes('content:write'));
      assert.ok(result.includes('content:read'));
      assert.strictEqual(result.length, 6);
    });

    test('admin role has all permissions', () => {
      const result = getAdminPermissions(['admin']);
      // Should have many permissions
      assert.ok(result.length >= 10);
      assert.ok(result.includes('users:manage'));
      assert.ok(result.includes('audit:read'));
    });
  });

  describe('buildAdminSession', () => {
    test('builds session from claims', () => {
      const claims = {
        roles: ['admin', 'something-else']
      };
      const session = buildAdminSession(claims as any);
      assert.deepStrictEqual(session.roles, ['admin']);
      assert.ok(session.permissions.includes('content:read'));
      assert.ok(session.permissions.includes('users:manage'));
    });

    test('returns empty session for no roles', () => {
      const session = buildAdminSession(null);
      assert.deepStrictEqual(session.roles, []);
      assert.deepStrictEqual(session.permissions, []);
    });
  });

  describe('hasAdminPermission', () => {
    const permissions: AdminPermission[] = ['content:read', 'content:write'];

    test('returns true when permission is present', () => {
      assert.strictEqual(hasAdminPermission(permissions, 'content:read'), true);
    });

    test('returns false when permission is absent', () => {
      assert.strictEqual(hasAdminPermission(permissions, 'users:manage'), false);
    });
  });
});
