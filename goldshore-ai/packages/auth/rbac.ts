import type { AccessTokenPayload } from "./verify";

export const ADMIN_ROLES = ["admin", "editor", "viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "content:read",
  "content:write",
  "content:publish",
  "media:read",
  "media:write",
  "media:delete",
  "forms:read",
  "forms:write",
  "forms:publish",
  "users:read",
  "users:manage",
  "audit:read"
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  admin: [...ADMIN_PERMISSIONS],
  editor: [
    "content:read",
    "content:write",
    "media:read",
    "media:write",
    "forms:read",
    "forms:write"
  ],
  viewer: ["content:read", "media:read", "forms:read"]
};

export type AdminSession = {
  roles: AdminRole[];
  permissions: AdminPermission[];
};

const normalizeRole = (role: string) => role.trim().toLowerCase();

export const extractAccessRoles = (claims: AccessTokenPayload | null) => {
  if (!claims) return [] as string[];
  const roles = new Set<string>();
  const candidates = [claims.roles, claims.role, claims.groups];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      candidate.forEach((value) => roles.add(normalizeRole(value)));
    } else if (typeof candidate === "string") {
      roles.add(normalizeRole(candidate));
    }
  }
  return Array.from(roles);
};

export const getAdminRoles = (claims: AccessTokenPayload | null) => {
  const roles = extractAccessRoles(claims);
  return roles.filter((role): role is AdminRole => ADMIN_ROLES.includes(role as AdminRole));
};

export const getAdminPermissions = (roles: AdminRole[]) => {
  const permissions = new Set<AdminPermission>();
  roles.forEach((role) => {
    ROLE_PERMISSIONS[role].forEach((permission) => permissions.add(permission));
  });
  return Array.from(permissions);
};

export const buildAdminSession = (claims: AccessTokenPayload | null): AdminSession => {
  const roles = getAdminRoles(claims);
  return {
    roles,
    permissions: getAdminPermissions(roles)
  };
};

export const hasAdminPermission = (
  permissions: AdminPermission[],
  required: AdminPermission
) => permissions.includes(required);
