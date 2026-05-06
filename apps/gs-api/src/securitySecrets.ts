export const CANONICAL_SECURITY_SECRETS = [
  'JWT_SECRET',
  'ACCESS_CLIENT_SECRET',
  'CLOUDFLARE_ACCESS_AUDIENCE',
  'CONTROL_SYNC_TOKEN',
] as const;

export const DEPRECATED_SECURITY_SECRET_ALIASES: Record<string, readonly string[]> = {
  JWT_SECRET: ['JWTSECRET'],
  ACCESS_CLIENT_SECRET: ['ACCESSCLIENTSECRET'],
  CLOUDFLARE_ACCESS_AUDIENCE: ['CLOUDFLAREACCESSAUDIENCE'],
  CONTROL_SYNC_TOKEN: ['CONTROLSYNCTOKEN'],
};

type EnvLike = Record<string, unknown>;

function isMissingSecuritySecretValue(value: unknown) {
  return value === undefined || value === null || value === '';
}

export function getSecuritySecretReport(env: EnvLike) {
  const missing = CANONICAL_SECURITY_SECRETS.filter((key) => {
    const value = env[key];
    return isMissingSecuritySecretValue(value);
  });

  const aliasConflicts: Array<{ canonical: string; alias: string }> = [];
  for (const [canonical, aliases] of Object.entries(DEPRECATED_SECURITY_SECRET_ALIASES)) {
    if (!isMissingSecuritySecretValue(env[canonical])) continue;
    for (const alias of aliases) {
      if (!isMissingSecuritySecretValue(env[alias])) {
        aliasConflicts.push({ canonical, alias });
      }
    }
  }

  return { missing, aliasConflicts };
}

export function assertSecuritySecrets(env: EnvLike, envName?: string) {
  const { missing, aliasConflicts } = getSecuritySecretReport(env);
  if (missing.length === 0 && aliasConflicts.length === 0) {
    return;
  }

  const messages: string[] = [];
  if (missing.length > 0) {
    messages.push(`missing required security secrets: ${missing.join(', ')}`);
  }
  if (aliasConflicts.length > 0) {
    messages.push(
      `deprecated alias usage detected: ${aliasConflicts
        .map(({ canonical, alias }) => `${alias} -> use ${canonical}`)
        .join('; ')}`,
    );
  }

  throw new Error(
    `SECURITY_PREFLIGHT_FAILED${envName ? `(${envName})` : ''}: ${messages.join(' | ')}`,
  );
}
