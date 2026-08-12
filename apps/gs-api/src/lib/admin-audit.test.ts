import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import { logAdminAction } from "../auth";
import type { Env } from "../types";

const deniedEntry = {
  action: "admin.access.denied",
  actor: "operator@example.com",
  status: "denied" as const,
  metadata: { permission: "system:integrations:manage" }
};

describe("admin audit persistence", () => {
  test("preserves the caller outcome when D1 persistence fails", async () => {
    const consoleError = mock.method(console, "error", () => undefined);
    const env = {
      PLATFORM_DB: {
        prepare: () => ({
          bind: () => ({
            run: async () => {
              throw new Error("D1 unavailable");
            }
          })
        })
      }
    } as unknown as Env;

    const result = await logAdminAction(env, deniedEntry);

    assert.equal(result.status, "denied");
    assert.equal(result.action, deniedEntry.action);
    assert.match(result.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(consoleError.mock.callCount(), 1);
    consoleError.mock.restore();
  });

  test("uses the bounded KV fallback when D1 is not bound", async () => {
    const writes: Array<{ key: string; value: string; ttl?: number }> = [];
    const env = {
      KV: {
        put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
          writes.push({ key, value, ttl: options?.expirationTtl });
        }
      }
    } as unknown as Env;

    const result = await logAdminAction(env, deniedEntry);

    assert.equal(result.status, "denied");
    assert.equal(writes.length, 1);
    assert.match(writes[0].key, /^audit:/);
    assert.equal(writes[0].ttl, 60 * 60 * 24 * 30);
    assert.deepEqual(JSON.parse(writes[0].value), result);
  });
});
