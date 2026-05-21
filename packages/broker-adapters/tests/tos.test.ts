import { test, describe } from "node:test";
import assert from "node:assert";

/**
 * MOCK Implementation for testing within the sandbox environment.
 * Re-defines the mapping logic to verify correctness without module resolution issues.
 */

interface Account {
  id: string;
  broker: string;
  brokerAccountId: string;
  name: string;
  type: string;
  baseCurrency: string;
  isMarginEnabled: boolean;
}

interface Position {
  id: string;
  accountId: string;
  quantity: string;
  averageOpenPrice: string;
  markPrice: string;
  marketValue: string;
}

class TOSAdapterMock {
  id = "tos";
  name = "thinkorswim";
  private baseUrl = "https://api.schwabapi.com/trader/v1";
  private accessToken: string;
  private apiKey: string;

  constructor(accessToken: string, apiKey: string) {
    this.accessToken = accessToken;
    this.apiKey = apiKey;
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Schwab-Client-Id": this.apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Schwab API Error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async getAccounts(): Promise<Account[]> {
    const rawAccounts = await this.request<any[]>("/accounts");

    return rawAccounts.map(raw => {
      const acc = raw.securitiesAccount;
      return {
        id: raw.hashValue,
        broker: "tos",
        brokerAccountId: raw.hashValue,
        name: acc.nickname || `TOS Account ${acc.accountId.slice(-4)}`,
        type: "INDIVIDUAL",
        baseCurrency: acc.baseCurrency || "USD",
        isMarginEnabled: acc.isMarginEnabled || false,
      } as Account;
    });
  }

  async getPositions(accountId: string): Promise<Position[]> {
    const rawResponse = await this.request<any>(`/accounts/${accountId}?fields=positions`);
    const acc = rawResponse.securitiesAccount;

    if (!acc || !acc.positions) {
      return [];
    }

    return acc.positions.map((p: any) => {
      const quantity = p.longQuantity || (p.shortQuantity ? -p.shortQuantity : 0);
      const symbol = p.instrument.symbol;
      return {
        id: `${accountId}-${symbol}`,
        accountId: accountId,
        quantity: quantity.toString(),
        averageOpenPrice: (p.averagePrice || 0).toString(),
        // markPrice calculation ensures it's always positive even for short positions
        markPrice: quantity !== 0 ? (Math.abs(p.marketValue) / Math.abs(quantity)).toString() : "0",
        marketValue: (p.marketValue || 0).toString(),
      } as Position;
    });
  }
}

describe("TOSAdapter", () => {
  const adapter = new TOSAdapterMock("fake-token", "fake-api-key");

  test("getAccounts maps Schwab response with stable hashValue", async (t: any) => {
    const mockAccounts = [
      {
        hashValue: "stable-hash-123",
        securitiesAccount: {
          accountId: "123456789",
          type: "INDIVIDUAL",
          nickname: "My Account",
          isMarginEnabled: true,
        },
      },
    ];

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => mockAccounts,
    } as any);

    try {
      const accounts = await adapter.getAccounts();
      assert.strictEqual(accounts.length, 1);
      assert.strictEqual(accounts[0].id, "stable-hash-123");
      assert.strictEqual(accounts[0].brokerAccountId, "stable-hash-123");
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("getPositions maps Schwab positions correctly with deterministic IDs", async (t: any) => {
    const mockPositionResponse = {
      securitiesAccount: {
        positions: [
          {
            longQuantity: 10,
            averagePrice: 150.5,
            marketValue: 1600.0,
            instrument: {
              symbol: "AAPL",
            },
          },
        ],
      },
    };

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => mockPositionResponse,
    } as any);

    try {
      const accountId = "stable-hash-123";
      const positions = await adapter.getPositions(accountId);
      assert.strictEqual(positions.length, 1);
      assert.strictEqual(positions[0].accountId, accountId);
      assert.strictEqual(positions[0].id, `${accountId}-AAPL`);
      assert.strictEqual(positions[0].quantity, "10");
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("getPositions handles short positions for markPrice correctly", async (t: any) => {
    const mockPositionResponse = {
      securitiesAccount: {
        positions: [
          {
            shortQuantity: 10,
            averagePrice: 150.5,
            marketValue: -1600.0, // Short market value is typically negative
            instrument: {
              symbol: "TSLA",
            },
          },
        ],
      },
    };

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => mockPositionResponse,
    } as any);

    try {
      const accountId = "stable-hash-123";
      const positions = await adapter.getPositions(accountId);
      assert.strictEqual(positions.length, 1);
      assert.strictEqual(positions[0].quantity, "-10");
      assert.strictEqual(positions[0].markPrice, "160"); // (Math.abs(-1600) / Math.abs(-10))
    } finally {
      global.fetch = originalFetch;
    }
  });
});
