export async function getServerEnv(): Promise<Record<string, unknown>> {
  const { env } = await import('cloudflare:workers');
  return env;
}
