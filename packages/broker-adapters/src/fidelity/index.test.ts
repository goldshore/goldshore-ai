import { FidelityAdapter } from "./index.ts";
import { describe, it } from "node:test";
import assert from "node:assert";

// Mock fetch for testing
const mockFetch = async (url: string) => {
  if (url.endsWith("/accounts")) {
    return new Response(JSON.stringify({
      accounts: [
        {
          id: "fid-1",
          accountNumber: "123456789",
          name: "Individual",
          type: "INDIVIDUAL",
          currency: "USD",
          marginEnabled: true,
          optionsLevel: 2,
          createdAt: "2023-01-01T00:00:00Z",
        }
      ]
    }), { status: 200 });
  }
  if (url.includes("/positions")) {
    return new Response(JSON.stringify({
      positions: [
        {
          id: "pos-1",
          instrumentId: "inst-1",
          quantity: 10,
          averagePrice: 150.5,
          lastPrice: 155.2,
          marketValue: 1552.0,
          dayPnl: 47.0,
          unrealizedPnl: 47.0,
        }
      ]
    }), { status: 200 });
  }
  return new Response(null, { status: 404 });
};

describe("FidelityAdapter", () => {
  it("should fetch and map accounts correctly", async () => {
    const adapter = new FidelityAdapter({
      accessToken: "test-token",
      fetchFn: mockFetch as any
    });

    const accounts = await adapter.getAccounts();
    assert.strictEqual(accounts.length, 1);
    assert.strictEqual(accounts[0].id, "fid-1");
    assert.strictEqual(accounts[0].broker, "fidelity");
    assert.strictEqual(accounts[0].brokerAccountId, "123456789");
    assert.strictEqual(accounts[0].name, "Individual");
    assert.strictEqual(accounts[0].isMarginEnabled, true);
    assert.strictEqual(accounts[0].isIraRestricted, false);
  });

  it("should fetch and map positions correctly", async () => {
    const adapter = new FidelityAdapter({
      accessToken: "test-token",
      fetchFn: mockFetch as any
    });

    const positions = await adapter.getPositions("fid-1");
    assert.strictEqual(positions.length, 1);
    assert.strictEqual(positions[0].id, "pos-1");
    assert.strictEqual(positions[0].accountId, "fid-1");
    assert.strictEqual(positions[0].quantity, "10");
    assert.strictEqual(positions[0].averageOpenPrice, "150.5");
  });
});
