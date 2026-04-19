import assert from "node:assert";
import { describe, it } from "node:test";

import { createApp } from "../index.ts";
import type { ControlEnv } from "../libs/types";

const validPayload = {
  ROUTING_TABLE: {
    "api.goldshore.ai": {
      role: "backend",
      target: "https://api.goldshore.ai",
      priority: 1
    }
  },
  SERVICE_STATUS: {
    maintenance_mode: false,
    active_services: ["api"],
    version: "2026.03.18"
  },
  AI_ORCHESTRATION: {
    preferred_model: "gpt-4o",
    agent_modules: ["triage"],
    queue_concurrency: 5,
    retry_attempts: 3
  }
} as const;

const createEnv = (overrides: Partial<ControlEnv> = {}) => {
  const writes = new Map<string, string>();
  const auditEntries: Array<{ key: string; value: string }> = [];

  const env = {
    CONTROL_LOGS: {
      put: async (key: string, value: string) => {
        auditEntries.push({ key, value });
      }
    },
    GS_CONFIG: {
      put: async (key: string, value: string) => {
        writes.set(key, value);
      }
    },
    STATE: {} as R2Bucket,
    API: { fetch: fetch.bind(globalThis) } as Fetcher,
    GATEWAY: { fetch: fetch.bind(globalThis) } as Fetcher,
    CONTROL_ADMIN_ROLES: "admin,ops",
    ...overrides
  } satisfies ControlEnv;

  return { env, writes, auditEntries };
};

describe("/system/sync", () => {
  it("rejects authenticated users without an admin role", async () => {
    const { env, writes } = createEnv();
    const app = createApp(async () => ({
      email: "viewer@example.com",
      roles: ["viewer"]
    }));

    const response = await app.request("http://localhost/system/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload)
    }, env);

    assert.strictEqual(response.status, 403);
    assert.deepStrictEqual(await response.json(), { error: "Forbidden" });
    assert.strictEqual(writes.size, 0);
  });

  it("persists system config for authorized admin users", async () => {
    const { env, writes, auditEntries } = createEnv();
    const app = createApp(async () => ({
      email: "admin@example.com",
      roles: ["admin"]
    }));

    const response = await app.request("http://localhost/system/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload)
    }, env);

    assert.strictEqual(response.status, 200);
    const body = await response.json() as { success: boolean; syncedAt: string };
    assert.strictEqual(body.success, true);
    assert.ok(body.syncedAt);

    assert.deepStrictEqual(JSON.parse(writes.get("ROUTING_TABLE") ?? "null"), validPayload.ROUTING_TABLE);
    assert.deepStrictEqual(JSON.parse(writes.get("SERVICE_STATUS") ?? "null"), validPayload.SERVICE_STATUS);
    assert.deepStrictEqual(JSON.parse(writes.get("AI_ORCHESTRATION") ?? "null"), validPayload.AI_ORCHESTRATION);
    assert.strictEqual(auditEntries.length, 1);
  });

  it("returns a server error when GS_CONFIG is unavailable", async () => {
    const { env } = createEnv({ GS_CONFIG: undefined as unknown as KVNamespace });
    const app = createApp(async () => ({
      email: "ops@example.com",
      roles: ["ops"]
    }));

    const response = await app.request("http://localhost/system/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload)
    }, env);

    assert.strictEqual(response.status, 500);
    assert.deepStrictEqual(await response.json(), { error: "Missing GS_CONFIG binding." });
  });
});
