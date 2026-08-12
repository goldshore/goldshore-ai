import {
  createGoogleServiceAccountAssertion,
  type GoogleServiceAccountCredentials,
} from '@goldshore/auth';
import type { Env } from '../types';

const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const GOOGLE_DIRECTORY_BASE = 'https://admin.googleapis.com/admin/directory/v1';
const GOOGLE_DIRECTORY_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
] as const;
const MAX_DIRECTORY_PAGES = 25;
const MAX_MANAGED_USERS = 500;

const ACCESS_APPLICATIONS = [
  'admin-production',
  'admin-preview',
  'api-production',
  'api-preview',
] as const;

export type WorkspaceAccessApplication = (typeof ACCESS_APPLICATIONS)[number];
export type WorkspaceRole = 'admin' | 'editor' | 'viewer';
type WorkspaceRoleLabel = WorkspaceRole | 'operator' | 'developer' | 'auditor' | 'analyst';

const ROLE_ALIASES: Record<WorkspaceRoleLabel, WorkspaceRole> = {
  admin: 'admin',
  editor: 'editor',
  viewer: 'viewer',
  operator: 'editor',
  developer: 'editor',
  auditor: 'viewer',
  analyst: 'viewer',
};

const ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
};

export class GoogleWorkspaceConfigurationError extends Error {
  readonly code = 'google_workspace_configuration';
}

export class GoogleWorkspaceProviderError extends Error {
  readonly code = 'google_workspace_provider';
}

export class GoogleWorkspaceSyncInProgressError extends Error {
  readonly code = 'google_workspace_sync_in_progress';
}

type WorkspaceConfig = {
  serviceAccount: GoogleServiceAccountCredentials;
  delegatedAdmin: string;
  customerId: string;
  groupRoles: Map<string, WorkspaceRole>;
  applications: WorkspaceAccessApplication[];
};

type GoogleDirectoryUser = {
  id: string;
  primaryEmail: string;
  name?: { fullName?: string };
  suspended?: boolean;
  archived?: boolean;
};

type GoogleDirectoryMember = {
  id?: string;
  email?: string;
  type?: string;
  status?: string;
};

export type WorkspaceAssignment = {
  googleId: string;
  email: string;
  displayName: string;
  role: WorkspaceRole;
  groups: string[];
};

export type WorkspaceAssignmentPlan = {
  assignments: WorkspaceAssignment[];
  inactiveUsers: number;
  unresolvedMembers: number;
};

export type GoogleWorkspaceSyncResult = {
  status: 'disabled' | 'success';
  runId?: string;
  usersSeen: number;
  usersGranted: number;
  usersDeprovisioned: number;
  conflicts: number;
  groupsScanned: number;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const parseJsonObject = (value: string, label: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('expected an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new GoogleWorkspaceConfigurationError(`${label} must be a valid JSON object.`);
  }
};

export const isGoogleWorkspaceSyncEnabled = (env: Env): boolean =>
  env.GOOGLE_WORKSPACE_SYNC_ENABLED === 'true';

export const isGoogleWorkspaceSyncConfigured = (env: Env): boolean =>
  Boolean(
    env.GOOGLE_ADMIN_SERVICE_ACCOUNT?.trim() &&
      env.GOOGLE_WORKSPACE_DELEGATED_ADMIN?.trim() &&
      env.GOOGLE_WORKSPACE_GROUP_ROLE_MAP?.trim() &&
      env.GOOGLE_WORKSPACE_ACCESS_APPLICATIONS?.trim(),
  );

export function readGoogleWorkspaceConfig(env: Env): WorkspaceConfig {
  if (!isGoogleWorkspaceSyncEnabled(env)) {
    throw new GoogleWorkspaceConfigurationError('Google Workspace synchronization is disabled.');
  }

  const serviceAccountRaw = env.GOOGLE_ADMIN_SERVICE_ACCOUNT?.trim();
  const delegatedAdmin = normalizeEmail(env.GOOGLE_WORKSPACE_DELEGATED_ADMIN ?? '');
  const customerId = env.GOOGLE_WORKSPACE_CUSTOMER_ID?.trim() || 'my_customer';
  const groupRoleRaw = env.GOOGLE_WORKSPACE_GROUP_ROLE_MAP?.trim();
  const applicationRaw = env.GOOGLE_WORKSPACE_ACCESS_APPLICATIONS?.trim();

  if (!serviceAccountRaw || !delegatedAdmin || !groupRoleRaw || !applicationRaw) {
    throw new GoogleWorkspaceConfigurationError(
      'Google Workspace credentials, delegated admin, group-role map, and applications are required.',
    );
  }

  const serviceAccountObject = parseJsonObject(
    serviceAccountRaw,
    'GOOGLE_ADMIN_SERVICE_ACCOUNT',
  );
  const clientEmail = serviceAccountObject.client_email;
  const privateKey = serviceAccountObject.private_key;
  const privateKeyId = serviceAccountObject.private_key_id;
  const tokenUri = serviceAccountObject.token_uri;
  if (typeof clientEmail !== 'string' || typeof privateKey !== 'string') {
    throw new GoogleWorkspaceConfigurationError(
      'GOOGLE_ADMIN_SERVICE_ACCOUNT must include client_email and private_key.',
    );
  }

  const groupRoleObject = parseJsonObject(groupRoleRaw, 'GOOGLE_WORKSPACE_GROUP_ROLE_MAP');
  const groupRoles = new Map<string, WorkspaceRole>();
  for (const [groupEmailRaw, roleRaw] of Object.entries(groupRoleObject)) {
    const groupEmail = normalizeEmail(groupEmailRaw);
    const roleLabel = typeof roleRaw === 'string' ? roleRaw.trim().toLowerCase() : '';
    if (!groupEmail || !(roleLabel in ROLE_ALIASES)) {
      throw new GoogleWorkspaceConfigurationError(
        `Unsupported Workspace role mapping for ${groupEmailRaw}.`,
      );
    }
    groupRoles.set(groupEmail, ROLE_ALIASES[roleLabel as WorkspaceRoleLabel]);
  }
  if (groupRoles.size === 0) {
    throw new GoogleWorkspaceConfigurationError(
      'GOOGLE_WORKSPACE_GROUP_ROLE_MAP must contain at least one group.',
    );
  }

  const applications = [...new Set(applicationRaw.split(',').map((value) => value.trim()))];
  if (
    applications.length === 0 ||
    applications.some(
      (application) =>
        !ACCESS_APPLICATIONS.includes(application as WorkspaceAccessApplication),
    )
  ) {
    throw new GoogleWorkspaceConfigurationError(
      'GOOGLE_WORKSPACE_ACCESS_APPLICATIONS contains an unsupported application.',
    );
  }

  return {
    serviceAccount: {
      client_email: clientEmail,
      private_key: privateKey,
      ...(typeof privateKeyId === 'string' ? { private_key_id: privateKeyId } : {}),
      ...(typeof tokenUri === 'string' ? { token_uri: tokenUri } : {}),
    },
    delegatedAdmin,
    customerId,
    groupRoles,
    applications: applications as WorkspaceAccessApplication[],
  };
}

const chooseRole = (roles: Iterable<WorkspaceRole>): WorkspaceRole => {
  let selected: WorkspaceRole = 'viewer';
  for (const role of roles) {
    if (ROLE_WEIGHT[role] > ROLE_WEIGHT[selected]) selected = role;
  }
  return selected;
};

export function buildWorkspaceAssignments(
  users: readonly GoogleDirectoryUser[],
  membersByGroup: ReadonlyMap<string, readonly GoogleDirectoryMember[]>,
  groupRoles: ReadonlyMap<string, WorkspaceRole>,
): WorkspaceAssignmentPlan {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.primaryEmail), user]));
  const assignments = new Map<
    string,
    { user: GoogleDirectoryUser; roles: Set<WorkspaceRole>; groups: Set<string> }
  >();
  let unresolvedMembers = 0;

  for (const [groupEmail, role] of groupRoles) {
    for (const member of membersByGroup.get(groupEmail) ?? []) {
      if (member.type && member.type !== 'USER') continue;
      if (member.status && member.status !== 'ACTIVE') continue;
      const user =
        (member.id ? usersById.get(member.id) : undefined) ??
        (member.email ? usersByEmail.get(normalizeEmail(member.email)) : undefined);
      if (!user) {
        unresolvedMembers += 1;
        continue;
      }
      const current = assignments.get(user.id) ?? {
        user,
        roles: new Set<WorkspaceRole>(),
        groups: new Set<string>(),
      };
      current.roles.add(role);
      current.groups.add(groupEmail);
      assignments.set(user.id, current);
    }
  }

  let inactiveUsers = 0;
  const activeAssignments: WorkspaceAssignment[] = [];
  for (const { user, roles, groups } of assignments.values()) {
    if (user.suspended || user.archived) {
      inactiveUsers += 1;
      continue;
    }
    activeAssignments.push({
      googleId: user.id,
      email: normalizeEmail(user.primaryEmail),
      displayName: user.name?.fullName?.trim() || normalizeEmail(user.primaryEmail),
      role: chooseRole(roles),
      groups: [...groups].sort(),
    });
  }

  return {
    assignments: activeAssignments.sort((left, right) => left.email.localeCompare(right.email)),
    inactiveUsers,
    unresolvedMembers,
  };
}

async function googleJson<T>(
  url: URL | string,
  accessToken: string,
  fetchImpl: FetchLike,
): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    console.error({
      event: 'google_workspace_api_error',
      status: response.status,
      url: new URL(String(url)).pathname,
    });
    throw new GoogleWorkspaceProviderError(
      `Google Workspace Directory API returned ${response.status}.`,
    );
  }
  return response.json() as Promise<T>;
}

async function getGoogleAccessToken(
  config: WorkspaceConfig,
  fetchImpl: FetchLike,
): Promise<string> {
  const tokenUri = config.serviceAccount.token_uri?.trim() || GOOGLE_TOKEN_URI;
  const assertion = await createGoogleServiceAccountAssertion(config.serviceAccount, {
    subject: config.delegatedAdmin,
    scopes: GOOGLE_DIRECTORY_SCOPES,
  });
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const response = await fetchImpl(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    console.error({ event: 'google_workspace_token_error', status: response.status });
    throw new GoogleWorkspaceProviderError(
      `Google Workspace token exchange returned ${response.status}.`,
    );
  }
  const payload = (await response.json()) as { access_token?: unknown };
  if (typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new GoogleWorkspaceProviderError('Google Workspace token response was incomplete.');
  }
  return payload.access_token;
}

async function listDirectoryUsers(
  config: WorkspaceConfig,
  accessToken: string,
  fetchImpl: FetchLike,
): Promise<GoogleDirectoryUser[]> {
  const users: GoogleDirectoryUser[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_DIRECTORY_PAGES; page += 1) {
    const url = new URL(`${GOOGLE_DIRECTORY_BASE}/users`);
    url.searchParams.set('customer', config.customerId);
    url.searchParams.set('maxResults', '500');
    url.searchParams.set('orderBy', 'email');
    url.searchParams.set('projection', 'basic');
    url.searchParams.set(
      'fields',
      'nextPageToken,users(id,primaryEmail,name(fullName),suspended,archived)',
    );
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const payload = await googleJson<{
      users?: GoogleDirectoryUser[];
      nextPageToken?: string;
    }>(url, accessToken, fetchImpl);
    users.push(...(payload.users ?? []));
    pageToken = payload.nextPageToken;
    if (!pageToken) return users;
  }
  throw new GoogleWorkspaceProviderError('Google Workspace user pagination exceeded its limit.');
}

async function listGroupMembers(
  groupEmail: string,
  accessToken: string,
  fetchImpl: FetchLike,
): Promise<GoogleDirectoryMember[]> {
  const members: GoogleDirectoryMember[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_DIRECTORY_PAGES; page += 1) {
    const url = new URL(
      `${GOOGLE_DIRECTORY_BASE}/groups/${encodeURIComponent(groupEmail)}/members`,
    );
    url.searchParams.set('includeDerivedMembership', 'true');
    url.searchParams.set('maxResults', '200');
    url.searchParams.set('fields', 'nextPageToken,members(id,email,status,type)');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const payload = await googleJson<{
      members?: GoogleDirectoryMember[];
      nextPageToken?: string;
    }>(url, accessToken, fetchImpl);
    members.push(...(payload.members ?? []));
    pageToken = payload.nextPageToken;
    if (!pageToken) return members;
  }
  throw new GoogleWorkspaceProviderError(
    `Google Workspace member pagination exceeded its limit for ${groupEmail}.`,
  );
}

type WorkspaceStateRow = {
  google_id: string;
  user_id: string;
  access_user_id: string;
  primary_email: string;
  role: WorkspaceRole;
  active: number;
  managed_access_user: number;
};

type UserRow = { id: string; email: string; status: string };
type AccessUserRow = { id: string; email: string; status: string };
type AccessRoleRow = {
  user_id: string;
  application: WorkspaceAccessApplication;
  role: WorkspaceRole;
};
type ManagedGrantRow = AccessRoleRow;

const keyForRole = (userId: string, application: string) => `${userId}\u0000${application}`;

async function readExistingState(db: D1Database) {
  const [workspace, users, accessUsers, accessRoles, managedGrants] = await Promise.all([
    db.prepare(
      `SELECT google_id, user_id, access_user_id, primary_email, role, active, managed_access_user
         FROM google_workspace_users`,
    ).all<WorkspaceStateRow>(),
    db.prepare(`SELECT id, email, status FROM users`).all<UserRow>(),
    db.prepare(`SELECT id, email, status FROM access_users`).all<AccessUserRow>(),
    db.prepare(
      `SELECT user_id, application, role
         FROM access_application_roles
        WHERE application IN ('admin-production', 'admin-preview', 'api-production', 'api-preview')`,
    ).all<AccessRoleRow>(),
    db.prepare(
      `SELECT access_user_id AS user_id, application, role
         FROM google_workspace_access_grants`,
    ).all<ManagedGrantRow>(),
  ]);
  return {
    workspace: workspace.results,
    users: users.results,
    accessUsers: accessUsers.results,
    accessRoles: accessRoles.results,
    managedGrants: managedGrants.results,
  };
}

async function markFailedRun(db: D1Database, runId: string, errorCode: string): Promise<void> {
  try {
    await db.batch([
      db.prepare(
        `UPDATE google_workspace_sync_runs
            SET status = 'failed', completed_at = ?1, error_code = ?2
          WHERE id = ?3`,
      ).bind(new Date().toISOString(), errorCode, runId),
      db.prepare(
        `INSERT INTO audit_events (id, occurred_at, actor, action, status, metadata_json)
         VALUES (?1, ?2, 'google-workspace-sync', 'google.workspace.sync', 'error', ?3)`,
      ).bind(
        crypto.randomUUID(),
        new Date().toISOString(),
        JSON.stringify({ runId, errorCode }),
      ),
    ]);
  } catch (auditError) {
    console.error({ event: 'google_workspace_sync_failure_audit_error', error: String(auditError) });
  }
}

async function beginSyncRun(db: D1Database, now: string): Promise<string> {
  await db.prepare(
      `UPDATE google_workspace_sync_runs
        SET status = 'failed', completed_at = ?1, error_code = 'stale_run'
      WHERE status = 'running'
        AND datetime(started_at) < datetime(?1, '-30 minutes')`,
  ).bind(now).run();
  const runId = crypto.randomUUID();
  try {
    await db.prepare(
      `INSERT INTO google_workspace_sync_runs (id, status, started_at)
       VALUES (?1, 'running', ?2)`,
    ).bind(runId, now).run();
  } catch {
    throw new GoogleWorkspaceSyncInProgressError(
      'A Google Workspace synchronization is already running.',
    );
  }
  return runId;
}

async function applyWorkspaceAssignments(
  db: D1Database,
  runId: string,
  config: WorkspaceConfig,
  plan: WorkspaceAssignmentPlan,
  usersSeen: number,
  now: string,
): Promise<GoogleWorkspaceSyncResult> {
  if (plan.assignments.length > MAX_MANAGED_USERS) {
    throw new GoogleWorkspaceConfigurationError(
      `Workspace sync is limited to ${MAX_MANAGED_USERS} managed users.`,
    );
  }

  const state = await readExistingState(db);
  const workspaceByGoogleId = new Map(state.workspace.map((row) => [row.google_id, row]));
  const usersById = new Map(state.users.map((row) => [row.id, row]));
  const usersByEmail = new Map(
    state.users.map((row) => [normalizeEmail(row.email), row]),
  );
  const accessUsersById = new Map(state.accessUsers.map((row) => [row.id, row]));
  const accessUsersByEmail = new Map(
    state.accessUsers.map((row) => [normalizeEmail(row.email), row]),
  );
  const accessRoles = new Map(
    state.accessRoles.map((row) => [keyForRole(row.user_id, row.application), row]),
  );
  const managedGrants = new Map(
    state.managedGrants.map((row) => [keyForRole(row.user_id, row.application), row]),
  );
  const currentGoogleIds = new Set(plan.assignments.map((assignment) => assignment.googleId));
  const statements: D1PreparedStatement[] = [];
  let conflicts = 0;

  for (const assignment of plan.assignments) {
    const previous = workspaceByGoogleId.get(assignment.googleId);
    const existingUser =
      (previous ? usersById.get(previous.user_id) : undefined) ??
      usersByEmail.get(assignment.email);
    const userId = previous?.user_id ?? existingUser?.id ?? crypto.randomUUID();
    const existingAccessUser =
      (previous ? accessUsersById.get(previous.access_user_id) : undefined) ??
      accessUsersByEmail.get(assignment.email);
    const accessUserId =
      previous?.access_user_id ?? existingAccessUser?.id ?? crypto.randomUUID();
    const managedAccessUser = previous?.managed_access_user ?? (existingAccessUser ? 0 : 1);

    if (existingUser) {
      statements.push(
        db.prepare(
          `UPDATE users
              SET email = ?1, display_name = ?2, updated_at = ?3,
                  status = CASE
                    WHEN id = ?4 AND status = 'deprovisioned' THEN 'active'
                    ELSE status
                  END,
                  disabled_at = CASE WHEN status = 'deprovisioned' THEN NULL ELSE disabled_at END
            WHERE id = ?4`,
        ).bind(assignment.email, assignment.displayName, now, userId),
      );
    } else {
      statements.push(
        db.prepare(
          `INSERT INTO users (id, email, display_name, status, created_at, updated_at)
           VALUES (?1, ?2, ?3, 'active', ?4, ?4)`,
        ).bind(userId, assignment.email, assignment.displayName, now),
      );
    }

    statements.push(
      db.prepare(
        `INSERT INTO identities
           (id, user_id, provider, provider_subject, email, created_at, last_seen_at)
         VALUES (?1, ?2, 'google_workspace', ?3, ?4, ?5, ?5)
         ON CONFLICT(provider, provider_subject) DO UPDATE SET
           user_id = excluded.user_id,
           email = excluded.email,
           last_seen_at = excluded.last_seen_at`,
      ).bind(`google-workspace:${assignment.googleId}`, userId, assignment.googleId, assignment.email, now),
    );

    if (existingAccessUser) {
      statements.push(
        db.prepare(
          `UPDATE access_users
              SET email = ?1,
                  status = CASE WHEN ?2 = 1 THEN 'active' ELSE status END,
                  updated_at = ?3
            WHERE id = ?4`,
        ).bind(assignment.email, managedAccessUser, now, accessUserId),
      );
    } else {
      statements.push(
        db.prepare(
          `INSERT INTO access_users (id, email, status, created_at, updated_at)
           VALUES (?1, ?2, 'active', ?3, ?3)`,
        ).bind(accessUserId, assignment.email, now),
      );
    }

    for (const application of config.applications) {
      const roleKey = keyForRole(accessUserId, application);
      const managedGrant = managedGrants.get(roleKey);
      const currentRole = accessRoles.get(roleKey);
      if (!managedGrant && currentRole) {
        conflicts += 1;
        continue;
      }
      statements.push(
        db.prepare(
          `INSERT INTO access_application_roles (user_id, application, role)
           VALUES (?1, ?2, ?3)
           ON CONFLICT(user_id, application) DO UPDATE SET role = excluded.role`,
        ).bind(accessUserId, application, assignment.role),
        db.prepare(
          `INSERT INTO google_workspace_access_grants
             (access_user_id, application, role, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?4)
           ON CONFLICT(access_user_id, application) DO UPDATE SET
             role = excluded.role,
             updated_at = excluded.updated_at`,
        ).bind(accessUserId, application, assignment.role, now),
      );
    }

    statements.push(
      db.prepare(
        `INSERT INTO google_workspace_users
           (google_id, user_id, access_user_id, primary_email, display_name, role,
            group_emails_json, active, managed_access_user, last_seen_at, deprovisioned_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?9, NULL)
         ON CONFLICT(google_id) DO UPDATE SET
           user_id = excluded.user_id,
           access_user_id = excluded.access_user_id,
           primary_email = excluded.primary_email,
           display_name = excluded.display_name,
           role = excluded.role,
           group_emails_json = excluded.group_emails_json,
           active = 1,
           managed_access_user = excluded.managed_access_user,
           last_seen_at = excluded.last_seen_at,
           deprovisioned_at = NULL`,
      ).bind(
        assignment.googleId,
        userId,
        accessUserId,
        assignment.email,
        assignment.displayName,
        assignment.role,
        JSON.stringify(assignment.groups),
        managedAccessUser,
        now,
      ),
    );
  }

  const deprovisioned = state.workspace.filter(
    (row) => row.active === 1 && !currentGoogleIds.has(row.google_id),
  );
  for (const previous of deprovisioned) {
    for (const grant of state.managedGrants.filter(
      (row) => row.user_id === previous.access_user_id,
    )) {
      statements.push(
        db.prepare(
          `DELETE FROM access_application_roles
            WHERE user_id = ?1 AND application = ?2 AND role = ?3`,
        ).bind(previous.access_user_id, grant.application, grant.role),
        db.prepare(
          `DELETE FROM google_workspace_access_grants
            WHERE access_user_id = ?1 AND application = ?2`,
        ).bind(previous.access_user_id, grant.application),
      );
    }
    if (previous.managed_access_user === 1) {
      statements.push(
        db.prepare(
          `UPDATE access_users
              SET status = 'disabled', updated_at = ?1
            WHERE id = ?2
              AND NOT EXISTS (
                SELECT 1 FROM access_application_roles WHERE user_id = ?2
              )`,
        ).bind(now, previous.access_user_id),
      );
    }
    statements.push(
      db.prepare(
        `UPDATE users
            SET status = 'deprovisioned', updated_at = ?1
          WHERE id = ?2 AND status = 'active'
            AND NOT EXISTS (
              SELECT 1 FROM identities
               WHERE user_id = ?2 AND provider <> 'google_workspace'
            )`,
      ).bind(now, previous.user_id),
      db.prepare(
        `UPDATE google_workspace_users
            SET active = 0, deprovisioned_at = ?1
          WHERE google_id = ?2`,
      ).bind(now, previous.google_id),
    );
  }

  const detail = {
    groupsScanned: config.groupRoles.size,
    inactiveUsers: plan.inactiveUsers,
    unresolvedMembers: plan.unresolvedMembers,
  };
  statements.push(
    db.prepare(
      `UPDATE google_workspace_sync_runs
          SET status = 'success', completed_at = ?1, users_seen = ?2,
              users_granted = ?3, users_deprovisioned = ?4, conflicts = ?5,
              detail_json = ?6
        WHERE id = ?7`,
    ).bind(
      now,
      usersSeen,
      plan.assignments.length,
      deprovisioned.length,
      conflicts,
      JSON.stringify(detail),
      runId,
    ),
    db.prepare(
      `INSERT INTO audit_events (id, occurred_at, actor, action, status, metadata_json)
       VALUES (?1, ?2, 'google-workspace-sync', 'google.workspace.sync', 'success', ?3)`,
    ).bind(
      crypto.randomUUID(),
      now,
      JSON.stringify({
        runId,
        usersSeen,
        usersGranted: plan.assignments.length,
        usersDeprovisioned: deprovisioned.length,
        conflicts,
        ...detail,
      }),
    ),
  );

  await db.batch(statements);
  return {
    status: 'success',
    runId,
    usersSeen,
    usersGranted: plan.assignments.length,
    usersDeprovisioned: deprovisioned.length,
    conflicts,
    groupsScanned: config.groupRoles.size,
  };
}

export async function syncGoogleWorkspaceRbac(
  env: Env,
  options: { fetchImpl?: FetchLike; now?: Date } = {},
): Promise<GoogleWorkspaceSyncResult> {
  if (!isGoogleWorkspaceSyncEnabled(env)) {
    return {
      status: 'disabled',
      usersSeen: 0,
      usersGranted: 0,
      usersDeprovisioned: 0,
      conflicts: 0,
      groupsScanned: 0,
    };
  }

  const config = readGoogleWorkspaceConfig(env);
  const now = (options.now ?? new Date()).toISOString();
  const runId = await beginSyncRun(env.PLATFORM_DB, now);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const accessToken = await getGoogleAccessToken(config, fetchImpl);
    const [users, memberEntries] = await Promise.all([
      listDirectoryUsers(config, accessToken, fetchImpl),
      Promise.all(
        [...config.groupRoles.keys()].map(async (groupEmail) => [
          groupEmail,
          await listGroupMembers(groupEmail, accessToken, fetchImpl),
        ] as const),
      ),
    ]);
    const plan = buildWorkspaceAssignments(
      users,
      new Map(memberEntries),
      config.groupRoles,
    );
    return await applyWorkspaceAssignments(
      env.PLATFORM_DB,
      runId,
      config,
      plan,
      users.length,
      now,
    );
  } catch (error) {
    const errorCode =
      error instanceof GoogleWorkspaceConfigurationError ||
      error instanceof GoogleWorkspaceProviderError ||
      error instanceof GoogleWorkspaceSyncInProgressError
        ? error.code
        : 'google_workspace_sync_failed';
    await markFailedRun(env.PLATFORM_DB, runId, errorCode);
    throw error;
  }
}
