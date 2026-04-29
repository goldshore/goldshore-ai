import type { ServerEnv } from './server-env';

export const requireAdminAccess = async (request: Request, env: ServerEnv) => {
  const expected = env.ADMIN_BEARER_TOKEN?.trim();
  if (!expected) {
    return { ok: true as const, status: 200, error: '' };
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (provided !== expected) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  return { ok: true as const, status: 200, error: '' };
};
