import { test, describe } from "node:test";
import assert from "node:assert";
import { TOSAdapter } from "./index.ts";

describe("TOSAdapter", () => {
  const mockFetch = async (url: string) => {
    if (url.endsWith("/accounts")) {
      return {
        status: 200,
        ok: true,
        json: async () => [
          {
            securitiesAccount: {
              accountId: "12345",
              type: "CASH"
            }
          }
        ]
      };
    }
    if (url.includes("/accounts/12345?fields=positions")) {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          securitiesAccount: {
            accountId: "12345",
            type: "CASH",
            positions: [
              {
                instrument: { symbol: "AAPL", assetType: "EQUITY" },
                longQuantity: 10,
                shortQuantity: 0,
                averagePrice: 150
              },
              {
                instrument: { symbol: "SPY", assetType: "EQUITY" },
                longQuantity: 0,
                shortQuantity: 5,
                averagePrice: 400
              }
            ]
          }
        })
      };
    }
    if (url.includes("/accounts/12345/orders")) {
        return {
          status: 200,
          ok: true,
          json: async () => [
            {
              orderId: 999,
              status: "FILLED",
              quantity: 1,
              enteredTime: "2026-03-18T10:00:00Z",
              orderLegCollection: [
                  {
                      instruction: "BUY",
                      instrument: { symbol: "MSFT", assetType: "EQUITY" }
                  }
              ]
            }
          ]
        };
      }
    return { status: 404, ok: false };
  };

  const adapter = new TOSAdapter({
    apiKey: "test-key",
    accessToken: "test-token",
    baseUrl: "https://api.tdameritrade.com/v1"
  });

  // Inject mock fetch into the client
  (adapter as any).client = {
      get: async (path: string) => {
          const res = await mockFetch("https://api.tdameritrade.com/v1" + path);
          return res;
      }
  };

  test("has correct metadata", () => {
    assert.strictEqual(adapter.id, "tos");
    assert.strictEqual(adapter.name, "thinkorswim");
  });

  test("getAccounts returns mapped accounts", async () => {
    const accounts = await adapter.getAccounts();
    assert.strictEqual(accounts.length, 1);
    assert.strictEqual(accounts[0].id, "12345");
    assert.strictEqual(accounts[0].broker, "tos");
  });

  test("getPositions returns mapped positions with correct signs", async () => {
    const positions = await adapter.getPositions("12345");
    assert.strictEqual(positions.length, 2);
    assert.strictEqual(positions[0].id, "12345-AAPL");
    assert.strictEqual(positions[0].quantity, "10");
    assert.strictEqual(positions[1].id, "12345-SPY");
    assert.strictEqual(positions[1].quantity, "-5");
  });

  test("getOrders returns mapped orders", async () => {
    const orders = await adapter.getOrders("12345");
    assert.strictEqual(orders.length, 1);
    assert.strictEqual(orders[0].id, "999");
    assert.strictEqual(orders[0].symbol, "MSFT");
    assert.strictEqual(orders[0].side, "BUY");
  });
});
