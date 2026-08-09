import type { ControlEnv } from './types';

export async function audit(env: ControlEnv) {
  await env.CONTROL_LOGS.put('access:last-audit', new Date().toISOString());
  return { ok: true, service: 'access' };
}
