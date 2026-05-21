import type { ControlEnv } from "../libs/types";

const ROTATION_CONFIG = [
  { name: "system-api-key" },
  { name: "internal-service-token" }
];

export async function rotateKeys(env: ControlEnv) {
  const timestamp = new Date().toISOString();
  console.info({
    event: "key_rotation_started",
    timestamp
  });

  const auditLog: {
    action: string;
    timestamp: string;
    results: { name: string; status: "success" | "error" | "skipped"; error?: string }[];
  } = {
    action: "rotate_keys",
    timestamp,
    results: []
  };

  for (const config of ROTATION_CONFIG) {
    const message = "Secure secret storage is not configured; rotation skipped.";
    console.warn({
      event: "key_rotation_skipped",
      name: config.name,
      reason: message,
      timestamp: new Date().toISOString()
    });
    auditLog.results.push({
      name: config.name,
      status: "skipped",
      error: message
    });
  }

  const auditKey = `audit:rotation:${timestamp}`;
  await env.CONTROL_LOGS.put(auditKey, JSON.stringify(auditLog));

  console.info({
    event: "key_rotation_complete",
    auditKey,
    timestamp: new Date().toISOString()
  });
}
