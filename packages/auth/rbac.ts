import type { AccessTokenPayload } from "./verify";

/** Resource/action permissions are deliberately explicit so the API can guard
 * every operation and the dashboard can render the same capability set. */
export const ADMIN_PERMISSIONS = [
  "dashboard:read",
  "cms:read", "cms:create", "cms:update", "cms:publish", "cms:delete",
  "api_configuration:read", "api_configuration:update",
  "mailboxes:read", "mailboxes:create", "mailboxes:update", "mailboxes:delete",
  "email_subscribers:read", "email_subscribers:create", "email_subscribers:update", "email_subscribers:delete",
  "forms:read", "forms:create", "forms:update", "forms:publish", "forms:delete",
  "deployments:read", "deployments:create", "deployments:promote",
  "rollbacks:read", "rollbacks:create",
  "integrations:read", "integrations:manage",
  "google_business_profile:read", "google_business_profile:manage",
  "github:read", "github:manage",
  "cloudflare_inventory:read", "cloudflare_inventory:manage",
  "secret_metadata:read", "secret_metadata:rotate",
  "users:read", "users:create", "users:invite", "users:update", "users:disable", "users:delete",
  "roles:read", "roles:manage",
  "approvals:read", "approvals:create", "approvals:approve", "approvals:execute",
  "audit:read",
  "content:read", "content:write", "content:publish",
  "media:read", "media:write",
  "forms:write",
  "system:read", "system:write",
  "ai:analyze",
  "google-business:read",
  "google-business:publish",
  "google-business:locations:manage",
  "google-business:reviews:manage",
  "google-business:accounts:manage"
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const VIEWER_PERMISSIONS: AdminPermission[] = [
  "dashboard:read", "cms:read", "api_configuration:read", "mailboxes:read",
  "email_subscribers:read", "forms:read", "deployments:read", "rollbacks:read",
  "integrations:read", "google_business_profile:read", "github:read",
  "cloudflare_inventory:read", "secret_metadata:read", "users:read", "roles:read",
  "content:read", "system:read", "media:read"
];

const EDITOR_PERMISSIONS: AdminPermission[] = [
  ...VIEWER_PERMISSIONS,
  "cms:create", "cms:update", "cms:publish", "content:write", "content:publish",
  "media:write", "forms:create", "forms:update", "forms:publish", "forms:write",
  "email_subscribers:create", "email_subscribers:update", "ai:analyze"
];

const ADMIN_EXCLUDED = new Set<AdminPermission>([
  "users:delete", "roles:manage", "secret_metadata:rotate", "deployments:promote",
  "approvals:execute"
]);

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  owner: [...ADMIN_PERMISSIONS],
  admin: ADMIN_PERMISSIONS.filter((permission) => !ADMIN_EXCLUDED.has(permission)),
  editor: EDITOR_PERMISSIONS,
  viewer: VIEWER_PERMISSIONS
};

export type AdminSession = { roles: AdminRole[]; permissions: AdminPermission[] };
const normalizeRole = (role: string) => role.trim().toLowerCase();

export const extractAccessRoles = (claims: AccessTokenPayload | null) => {
  if (!claims) return [] as string[];
  const roles = new Set<string>();
  for (const candidate of [claims.roles, claims.role, claims.groups]) {
    if (Array.isArray(candidate)) candidate.forEach((value) => roles.add(normalizeRole(value)));
    else if (typeof candidate === "string") roles.add(normalizeRole(candidate));
  }
  return [...roles];
};

export const getAdminRoles = (claims: AccessTokenPayload | null) =>
  extractAccessRoles(claims).filter((role): role is AdminRole => ADMIN_ROLES.includes(role as AdminRole));

export const getAdminPermissions = (roles: AdminRole[]) => {
  const permissions = new Set<AdminPermission>();
  roles.forEach((role) => ROLE_PERMISSIONS[role].forEach((permission) => permissions.add(permission)));
  return [...permissions];
};

export const buildAdminSession = (claims: AccessTokenPayload | null): AdminSession => {
  const roles = getAdminRoles(claims);
  return { roles, permissions: getAdminPermissions(roles) };
};

export const hasAdminPermission = (permissions: readonly string[], required: AdminPermission) =>
  permissions.includes(required);

export const isAdmin = (claims: AccessTokenPayload | null) =>
  getAdminRoles(claims).some((role) => role === "owner" || role === "admin");
