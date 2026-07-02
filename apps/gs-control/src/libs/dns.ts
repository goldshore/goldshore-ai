import type { ControlEnv } from './types';

export async function sync(env: ControlEnv) {
  await env.CONTROL_LOGS.put('dns:last-run', new Date().toISOString());
  return { ok: true, service: 'dns' };
}
