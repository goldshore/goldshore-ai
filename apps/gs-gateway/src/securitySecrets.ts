export const CANONICAL_SECURITY_SECRETS = [
  'ACCESS_CLIENT_SECRET',
  'CLOUDFLARE_ACCESS_AUDIENCE',
] as const;

const DEPRECATED_ALIASES: Record<string, readonly string[]> = {
  ACCESS_CLIENT_SECRET: ['ACCESSCLIENTSECRET'],
  CLOUDFLARE_ACCESS_AUDIENCE: ['CLOUDFLAREACCESSAUDIENCE'],
};

type EnvLike = Record<string, unknown>;

export function assertSecuritySecrets(env: EnvLike, envName?: string) {
  const missing = CANONICAL_SECURITY_SECRETS.filter((key) => !env[key]);
  const aliasOnly: string[] = [];

  for (const key of missing) {
    for (const alias of DEPRECATED_ALIASES[key] ?? []) {
      if (env[alias]) {
        aliasOnly.push(`${alias} -> use ${key}`);
      }
    }
  }

  if (missing.length === 0 && aliasOnly.length === 0) {
    return;
  }

  throw new Error(
    `SECURITY_PREFLIGHT_FAILED${envName ? `(${envName})` : ''}: missing required security secrets: ${missing.join(', ')}${
      aliasOnly.length > 0 ? ` | deprecated alias usage detected: ${aliasOnly.join('; ')}` : ''
    }`,
  );
}
