import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GoogleWorkspaceConfigurationError,
  buildWorkspaceAssignments,
  readGoogleWorkspaceConfig,
  syncGoogleWorkspaceRbac,
} from './google-workspace-rbac';
import type { Env } from '../types';

describe('Google Workspace RBAC synchronization', () => {
  it('remains a no-op until an operator explicitly enables it', async () => {
    const result = await syncGoogleWorkspaceRbac({
      GOOGLE_WORKSPACE_SYNC_ENABLED: 'false',
    } as Env);
    assert.deepEqual(result, {
      status: 'disabled',
      usersSeen: 0,
      usersGranted: 0,
      usersDeprovisioned: 0,
      conflicts: 0,
      groupsScanned: 0,
    });
  });

  it('maps Claude role labels onto canonical Access roles and rejects owner automation', () => {
    const env = {
      GOOGLE_WORKSPACE_SYNC_ENABLED: 'true',
      GOOGLE_ADMIN_SERVICE_ACCOUNT: JSON.stringify({
        client_email: 'sync@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
      }),
      GOOGLE_WORKSPACE_DELEGATED_ADMIN: 'ADMIN@EXAMPLE.COM',
      GOOGLE_WORKSPACE_GROUP_ROLE_MAP: JSON.stringify({
        'operators@example.com': 'operator',
        'auditors@example.com': 'auditor',
      }),
      GOOGLE_WORKSPACE_ACCESS_APPLICATIONS: 'admin-production,api-production',
    } as Env;
    const config = readGoogleWorkspaceConfig(env);
    assert.equal(config.groupRoles.get('operators@example.com'), 'editor');
    assert.equal(config.groupRoles.get('auditors@example.com'), 'viewer');
    assert.equal(config.delegatedAdmin, 'admin@example.com');

    assert.throws(
      () =>
        readGoogleWorkspaceConfig({
          ...env,
          GOOGLE_WORKSPACE_GROUP_ROLE_MAP: JSON.stringify({
            'owners@example.com': 'owner',
          }),
        }),
      GoogleWorkspaceConfigurationError,
    );
  });

  it('selects the highest group role and omits suspended users', () => {
    const plan = buildWorkspaceAssignments(
      [
        { id: '1', primaryEmail: 'admin@example.com', name: { fullName: 'Admin User' } },
        { id: '2', primaryEmail: 'paused@example.com', suspended: true },
      ],
      new Map([
        [
          'editors@example.com',
          [
            { id: '1', type: 'USER', status: 'ACTIVE' },
            { id: '2', type: 'USER', status: 'ACTIVE' },
          ],
        ],
        ['admins@example.com', [{ email: 'admin@example.com', type: 'USER', status: 'ACTIVE' }]],
      ]),
      new Map([
        ['editors@example.com', 'editor'],
        ['admins@example.com', 'admin'],
      ]),
    );

    assert.deepEqual(plan.assignments, [
      {
        googleId: '1',
        email: 'admin@example.com',
        displayName: 'Admin User',
        role: 'admin',
        groups: ['admins@example.com', 'editors@example.com'],
      },
    ]);
    assert.equal(plan.inactiveUsers, 1);
    assert.equal(plan.unresolvedMembers, 0);
  });
});
