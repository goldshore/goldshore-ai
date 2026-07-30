export function getServerEnv(locals: Record<string, unknown>): Record<string, unknown> {
  const runtime = locals['runtime'] as { env?: Record<string, unknown> } | undefined;
  return runtime?.env ?? {};
}
