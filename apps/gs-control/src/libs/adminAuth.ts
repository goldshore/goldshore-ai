import type { AccessTokenPayload } from '@goldshore/auth';

const DEFAULT_REQUIRED_ROLES = ['admin', 'ops'];

export function getRequiredRoles(env: { CONTROL_ADMIN_ROLES?: string }): string[] {
  return (env.CONTROL_ADMIN_ROLES ?? DEFAULT_REQUIRED_ROLES.join(','))
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export function isAuthorizedRole(claims: AccessTokenPayload | null | undefined, requiredRoles: string[]): boolean {
  if (!claims) return false;
  const roles = new Set<string>();
  for (const candidate of [claims.roles, claims.role, claims.groups]) {
    if (Array.isArray(candidate)) candidate.forEach((role) => roles.add(String(role).toLowerCase()));
    else if (typeof candidate === 'string') roles.add(candidate.toLowerCase());
  }
  return requiredRoles.some((role) => roles.has(role.toLowerCase()));
}
