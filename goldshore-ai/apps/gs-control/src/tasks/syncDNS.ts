import type { ControlEnv } from "../libs/types";

export async function syncDNS(env: ControlEnv) {
  // Example DNS sync logic
  const res = await env.API.fetch("https://api.goldshore.ai/health");
  return res.ok;
}
