/**
 * RBAC (Role-Based Access Control) Utilities
 * Provides functions for permission checking, role management, and audit logging
 */

import type {
  AdminUser,
  AdminRole,
  AdminPermission,
  AdminAuditLog,
  PermissionId,
  AuditAction,
} from './types/rbac';

/**
 * Parse permission IDs from JSON string
 * @param permissionsJson - JSON array string of permission IDs
 * @returns Array of permission IDs
 */
export function parsePermissions(permissionsJson: string): PermissionId[] {
  try {
    return JSON.parse(permissionsJson);
  } catch {
    console.error('Failed to parse permissions JSON:', permissionsJson);
    return [];
  }
}

/**
 * Serialize permission IDs to JSON string
 * @param permissions - Array of permission IDs
 * @returns JSON array string
 */
export function serializePermissions(permissions: PermissionId[]): string {
  return JSON.stringify(permissions);
}

/**
 * Check if user has required permission
 * @param user - Admin user record
 * @param role - Admin role record
 * @param requiredPermission - Permission ID to check
 * @returns true if user has permission, false otherwise
 */
export function hasPermission(
  user: AdminUser,
  role: AdminRole,
  requiredPermission: PermissionId,
): boolean {
  if (user.status !== 'active') {
    return false;
  }

  const permissions = parsePermissions(role.permissions);
  return permissions.includes(requiredPermission);
}

/**
 * Check if user has any of the required permissions
 * @param user - Admin user record
 * @param role - Admin role record
 * @param requiredPermissions - Array of permission IDs (any match succeeds)
 * @returns true if user has at least one permission
 */
export function hasAnyPermission(
  user: AdminUser,
  role: AdminRole,
  requiredPermissions: PermissionId[],
): boolean {
  if (user.status !== 'active') {
    return false;
  }

  const permissions = parsePermissions(role.permissions);
  return requiredPermissions.some((perm) => permissions.includes(perm));
}

/**
 * Check if user has all required permissions
 * @param user - Admin user record
 * @param role - Admin role record
 * @param requiredPermissions - Array of permission IDs (all must match)
 * @returns true if user has all permissions
 */
export function hasAllPermissions(
  user: AdminUser,
  role: AdminRole,
  requiredPermissions: PermissionId[],
): boolean {
  if (user.status !== 'active') {
    return false;
  }

  const permissions = parsePermissions(role.permissions);
  return requiredPermissions.every((perm) => permissions.includes(perm));
}

/**
 * Create audit log entry
 * @param params - Audit log parameters
 * @returns Audit log record with generated ID and timestamp
 */
export function createAuditLogEntry(params: {
  actor_email: string;
  action: AuditAction;
  target_type: 'role' | 'user' | 'permission';
  target_id: string;
  target_name?: string;
  changes?: Record<string, any>;
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  status?: 'success' | 'failure';
  error_message?: string;
}): Omit<AdminAuditLog, 'id' | 'timestamp'> {
  return {
    actor_email: params.actor_email,
    action: params.action,
    target_type: params.target_type,
    target_id: params.target_id,
    target_name: params.target_name,
    changes: params.changes ? JSON.stringify(params.changes) : undefined,
    reason: params.reason,
    ip_address: params.ip_address,
    user_agent: params.user_agent,
    status: params.status || 'success',
    error_message: params.error_message,
  };
}

/**
 * Parse audit log changes from JSON string
 * @param changesJson - JSON string with before/after state
 * @returns Parsed object or undefined
 */
export function parseAuditChanges(changesJson?: string): Record<string, any> | undefined {
  if (!changesJson) return undefined;

  try {
    return JSON.parse(changesJson);
  } catch {
    console.error('Failed to parse audit changes JSON:', changesJson);
    return undefined;
  }
}

/**
 * Generate change summary for audit log
 * @param before - Before state
 * @param after - After state
 * @returns Object with before/after values
 */
export function generateChangesSummary(
  before: Record<string, any>,
  after: Record<string, any>,
): Record<string, any> {
  const changes: Record<string, any> = {};

  // Find all keys in before and after
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeValue = before[key];
    const afterValue = after[key];

    // Only include if value changed
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[key] = {
        before: beforeValue,
        after: afterValue,
      };
    }
  }

  return changes;
}

/**
 * Validate role name
 * @param name - Role name to validate
 * @returns true if valid, false otherwise
 */
export function isValidRoleName(name: string): boolean {
  // Alphanumeric, hyphens, underscores, 3-50 chars
  return /^[a-z0-9_-]{3,50}$/.test(name.toLowerCase());
}

/**
 * Validate email address
 * @param email - Email to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Redact sensitive information from audit log
 * @param auditLog - Audit log record
 * @returns Audit log with redacted sensitive fields
 */
export function redactAuditLog(auditLog: AdminAuditLog): AdminAuditLog {
  const redacted = { ...auditLog };

  // Redact changes if they contain secrets/keys
  if (redacted.changes) {
    try {
      const changesObj = JSON.parse(redacted.changes);
      const redactedChanges: Record<string, any> = {};

      for (const [key, value] of Object.entries(changesObj)) {
        // Redact keys containing 'secret', 'key', 'token', 'password'
        if (
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('password')
        ) {
          redactedChanges[key] = {
            before: '[REDACTED]',
            after: '[REDACTED]',
          };
        } else {
          redactedChanges[key] = value;
        }
      }

      redacted.changes = JSON.stringify(redactedChanges);
    } catch {
      // If changes is not valid JSON, leave as-is
    }
  }

  return redacted;
}

/**
 * Get default role for new users
 * @returns Default role ID ('viewer' role)
 */
export function getDefaultRoleId(): string {
  return 'role_viewer';
}

/**
 * Get all available role IDs
 * @returns Array of role IDs
 */
export function getDefaultRoleIds(): string[] {
  return [
    'role_superadmin',
    'role_admin',
    'role_operator',
    'role_viewer',
    'role_auditor',
  ];
}

/**
 * Check if role is a default/system role
 * @param roleId - Role ID to check
 * @returns true if role is a default role
 */
export function isDefaultRole(roleId: string): boolean {
  return getDefaultRoleIds().includes(roleId);
}

/**
 * Check if operation is allowed based on role hierarchy
 * Role hierarchy: superadmin > admin > operator > viewer > auditor
 * @param actorRoleId - Actor's role ID
 * @param targetRoleId - Target role ID (role being modified)
 * @returns true if actor can modify target role
 */
export function canModifyRole(actorRoleId: string, targetRoleId: string): boolean {
  const roleHierarchy: Record<string, number> = {
    role_superadmin: 5,
    role_admin: 4,
    role_operator: 3,
    role_viewer: 2,
    role_auditor: 1,
  };

  const actorLevel = roleHierarchy[actorRoleId] ?? 0;
  const targetLevel = roleHierarchy[targetRoleId] ?? 0;

  // Can only modify roles at same level or lower
  return actorLevel >= targetLevel;
}
