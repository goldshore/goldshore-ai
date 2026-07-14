import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { Hono } from "hono";
import integrations from "./integrations";
import { Env, Variables } from "../types";

const createTestApp = (claims: any = null) => {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  const mockKV = {
    get: mock.fn(async () => null),
    list: mock.fn(async () => ({ keys: [] })),
    put: mock.fn(async () => {}),
    delete: mock.fn(async () => {}),
  };

  app.use("*", async (c, next) => {
    c.set("accessClaims", claims);
    c.env = { KV: mockKV } as any;
    await next();
  });

  app.route("/integrations", integrations);
  return { app, mockKV };
};

describe("Integration Management API Security", () => {
  it("POST /integrations requires integration management permission before KV mutation", async () => {
    const { app, mockKV } = createTestApp({ roles: ["viewer"] });
    const res = await app.request("/integrations", {
      method: "POST",
      body: JSON.stringify({
        action: "delete",
        config: { name: "facebook-pixel" },
      }),
      headers: { "Content-Type": "application/json" },
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(mockKV.delete.mock.callCount(), 0);
    assert.strictEqual(mockKV.put.mock.callCount(), 1, "only audit denial should be written");
  });

  it("GET /integrations?action=sync requires integration management permission before registry load", async () => {
    const { app, mockKV } = createTestApp({ roles: ["viewer"] });
    const res = await app.request("/integrations?action=sync");

    assert.strictEqual(res.status, 403);
    assert.strictEqual(mockKV.list.mock.callCount(), 0);
    assert.strictEqual(mockKV.put.mock.callCount(), 1, "only audit denial should be written");
  });
});
