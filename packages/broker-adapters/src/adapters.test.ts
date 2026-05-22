import { test } from "node:test";
import assert from "node:assert/strict";
import { RobinhoodAdapter } from "./robinhood/index.ts";
import { FidelityAdapter } from "./fidelity/index.ts";
import { TOSAdapter } from "./tos/index.ts";

test("RobinhoodAdapter implements BrokerAdapter", async () => {
  const adapter = new RobinhoodAdapter();
  assert.equal(adapter.id, "robinhood");
  assert.equal(typeof adapter.getAccounts, "function");
  assert.equal(typeof adapter.getPositions, "function");

  const accounts = await adapter.getAccounts();
  assert.ok(Array.isArray(accounts));

  const positions = await adapter.getPositions("test-id");
  assert.ok(Array.isArray(positions));
});

test("FidelityAdapter implements BrokerAdapter", async () => {
  const adapter = new FidelityAdapter();
  assert.equal(adapter.id, "fidelity");
  assert.equal(typeof adapter.getAccounts, "function");
  assert.equal(typeof adapter.getPositions, "function");

  const accounts = await adapter.getAccounts();
  assert.ok(Array.isArray(accounts));

  const positions = await adapter.getPositions("test-id");
  assert.ok(Array.isArray(positions));
});

test("TOSAdapter implements BrokerAdapter", async () => {
  const adapter = new TOSAdapter();
  assert.equal(adapter.id, "tos");
  assert.equal(typeof adapter.getAccounts, "function");
  assert.equal(typeof adapter.getPositions, "function");

  const accounts = await adapter.getAccounts();
  assert.ok(Array.isArray(accounts));

  const positions = await adapter.getPositions("test-id");
  assert.ok(Array.isArray(positions));
});
