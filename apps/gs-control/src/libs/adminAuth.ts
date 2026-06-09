import type { AccessTokenPayload } from "@goldshore/auth";

import type { ControlEnv } from "./types";

export const DEFAULT_ADMIN_ROLES = ["admin", "ops", "owner", "infra"];

export const getRequiredRoles = (env: ControlEnv) => {
  const configured = env.CONTROL_ADMIN_ROLES?.split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : DEFAULT_ADMIN_ROLES;
};

export const extractRoles = (claims: AccessTokenPayload | null | undefined) => {
  if (!claims) {
    return [];
  }

  const roles = new Set<string>();
  const candidates = [claims.roles, claims.role, claims.groups];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      candidate.forEach((value) => {
        if (typeof value === "string") {
          roles.add(value.toLowerCase());
        }
      });
    } else if (typeof candidate === "string") {
      roles.add(candidate.toLowerCase());
    }
  }

  return Array.from(roles);
};

export const isAuthorizedRole = (
  claims: AccessTokenPayload | null | undefined,
  requiredRoles: string[]
) => {
  const roles = extractRoles(claims);

  if (roles.length === 0) {
    return false;
  }

  const required = requiredRoles.map((role) => role.toLowerCase());
  return roles.some((role) => required.includes(role));
};
