export interface ServerEnv {
  ADMIN_BEARER_TOKEN?: string;
  GS_API_BASE_URL?: string;
}

export const getServerEnv = (locals: Record<string, unknown>): ServerEnv => {
  const runtime = (locals.runtime as { env?: Record<string, unknown> } | undefined)?.env ?? {};
  return {
    ADMIN_BEARER_TOKEN:
      typeof runtime.ADMIN_BEARER_TOKEN === 'string' ? runtime.ADMIN_BEARER_TOKEN : undefined,
    GS_API_BASE_URL:
      typeof runtime.GS_API_BASE_URL === 'string' ? runtime.GS_API_BASE_URL : undefined,
  };
};
