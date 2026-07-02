import type { ControlEnv } from './types';

export async function deploy(env: ControlEnv) {
  await env.CONTROL_LOGS.put('pages:last-deploy', new Date().toISOString());
  return { ok: true, service: 'pages' };
}
