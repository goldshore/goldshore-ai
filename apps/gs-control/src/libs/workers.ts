import type { ControlEnv } from './types';

export async function reconcile(env: ControlEnv) {
  await env.CONTROL_LOGS.put('workers:last-reconcile', new Date().toISOString());
  return { ok: true, service: 'workers' };
}
