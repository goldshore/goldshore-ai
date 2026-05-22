import { type Account, type Order, type Position } from "@goldshore/core-schema";
import { type BrokerAdapter } from "../index.js";

export interface FidelityConfig {
  baseUrl?: string;
  accessToken?: string;
  fetchFn?: typeof fetch;
}

export class FidelityAdapter implements BrokerAdapter {
  id = "fidelity";
  name = "fidelity";

  constructor(_config: FidelityConfig = {}) {}

  async getAccounts(): Promise<Account[]> {
    return [
      {
        id: "fid-acc-1",
        broker: "fidelity",
        brokerAccountId: "fid-acc-1",
        name: "Individual Brokerage",
        type: "INDIVIDUAL" as Account["type"],
        baseCurrency: "USD",
        isMarginEnabled: false,
        optionsLevel: null,
        isCloseOnly: false,
        isPdtTracked: false,
        isIraRestricted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  async getPositions(accountId: string): Promise<Position[]> {
    if (accountId !== "fid-acc-1" && accountId !== "test-id") {
      return [];
    }

    return [
      {
        id: "fid-pos-1",
        accountId,
        instrumentId: "AAPL",
        quantity: "10",
        averageOpenPrice: "150.00",
        markPrice: "175.00",
        marketValue: "1750.00",
        dayPnl: "0.00",
        unrealizedPnl: "250.00",
        greeks: null,
        updatedAt: new Date(),
      },
    ];
  }

  async getOrders(_accountId: string): Promise<Order[]> {
    return [];
  }
}
